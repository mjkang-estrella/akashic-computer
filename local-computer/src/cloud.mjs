import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { stateDir } from "./config.mjs";
export function cloudConfig() {
  try {
    return JSON.parse(readFileSync(join(stateDir, "cloud.json"), "utf8"));
  } catch {
    return null;
  }
}
export async function cloudCall(
  operation,
  body,
  configuration = cloudConfig(),
) {
  if (!configuration)
    throw new Error("Connect this controller to your account first.");
  const r = await fetch(`${configuration.site}/connector/${operation}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${configuration.token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  });
  const data = await r.json();
  if (!r.ok) {
    const e = new Error(data.error || `Cloud request failed (${r.status})`);
    e.status = r.status;
    throw e;
  }
  return data;
}
export class CloudRelay {
  constructor(store, fleet, runner, config, options = {}) {
    this.request = options.request || cloudCall;
    this.paired = options.paired || cloudConfig;
    this.failures = 0;
    this.nextAttempt = 0;
    this.store = store;
    this.fleet = fleet;
    this.runner = runner;
    this.config = config;
    this.stopped = false;
    this.lastHeartbeat = 0;
    this.lastClaim = 0;
    this.lastError = null;
    this.busy = false;
    this.inventorySignature = null;
    this.reported = new Map();
  }
  start() {
    this.timer = setInterval(() => void this.tick(), 1000);
    void this.tick();
  }
  stop() {
    this.stopped = true;
    clearInterval(this.timer);
  }
  async tick() {
    if (
      this.busy ||
      this.stopped ||
      this.config.relayEnabled === false ||
      !this.paired() ||
      Date.now() < this.nextAttempt
    )
      return;
    this.busy = true;
    try {
      if (Date.now() - this.lastHeartbeat > 15000) {
        const snapshot = await this.fleet.snapshot();
        const models = await this.fleet.models();
        const devices = snapshot.hosts.map((h) => ({
          localId: h.id,
          name: h.id === "local-mac" ? "This Mac" : h.id,
          role: h.role || "controller",
          state: h.state || "observed",
          status: h.status,
          ...(h.observedAt ? { observedAt: Date.parse(h.observedAt) } : {}),
          ...(h.hardware ? { hardware: h.hardware } : {}),
          ...(h.memory?.MemTotal
            ? {
                memoryTotal: h.memory.MemTotal,
                memoryAvailable: h.memory.MemAvailable,
              }
            : {}),
          ...(h.allocation_group ? { group: h.allocation_group } : {}),
          ...(h.error
            ? { note: h.error }
            : h.failedUnits && h.failedUnits !== "unavailable"
              ? { note: h.failedUnits.slice(0, 1000) }
              : {}),
        }));
        const deployments = models.models.map((m) => ({
          localId: m.id,
          model: m.id,
          status: models.status,
          ...(this.config.artifactRepo
            ? { artifactRepo: this.config.artifactRepo }
            : {}),
        }));
        const inventorySignature = JSON.stringify({
          pairing: this.paired(),
          devices: devices
            .map((device) => ({ ...device, observedAt: undefined }))
            .sort((a, b) => a.localId.localeCompare(b.localId)),
          deployments: [...deployments].sort((a, b) =>
            a.localId.localeCompare(b.localId),
          ),
        });
        await this.request("heartbeat", {
          ...(inventorySignature !== this.inventorySignature
            ? { devices, deployments }
            : {}),
          ...(this.config.controllerName
            ? { name: this.config.controllerName }
            : {}),
        });
        this.inventorySignature = inventorySignature;
        this.lastHeartbeat = Date.now();
        this.failures = 0;
        this.nextAttempt = 0;
      }
      const pairing = this.paired();
      const samePairing = (j) =>
        j.cloudConnectorId === pairing.connectorId &&
        j.cloudSite === pairing.site;
      const unsynced = this.store.data.jobs.find(
        (j) => j.cloudJobId && !j.cloudCompleted && samePairing(j),
      );
      if (unsynced) {
        await this.report(unsynced);
        return;
      }
      if (
        this.runner.active ||
        this.store.data.jobs.some((j) => j.status === "queued")
      )
        return;
      if (Date.now() - this.lastClaim < 5000) return;
      this.lastClaim = Date.now();
      const claim = await this.request("claim", { leaseId: randomUUID() });
      if (!claim) return;
      const prior = this.store.data.jobs.find(
        (j) => j.cloudJobId === claim.job._id && samePairing(j),
      );
      if (prior) {
        prior.cloudCompleted = false;
        await this.report(prior);
        return;
      }
      if (claim.reconcile) {
        await this.request("progress", {
          jobId: claim.job._id,
          leaseId: claim.job.leaseId,
          sequence: claim.job.lastSequence + 1,
          content: "",
          events: [],
          rounds: 0,
          promptTokens: 0,
          completionTokens: 0,
          status: "interrupted",
          error:
            "No durable local execution receipt. Not replayed automatically.",
        });
        return;
      }
      const models = await this.fleet.models();
      if (!models.models.some((m) => m.id === claim.deployment?.model))
        throw new Error(
          "Assigned deployment is not configured on this controller",
        );
      const s = this.store.createSession(
        claim.conversation.title,
        claim.conversation.mode,
      );
      s.cloudConversationId = claim.conversation._id;
      s.messages = claim.messages.slice(0, -1).map((m) => ({ ...m }));
      const j = this.store.enqueue(
        s.id,
        claim.job.prompt,
        `cloud:${claim.job._id}`,
        claim.job.maxTokens,
        {
          cloudConnectorId: pairing.connectorId,
          cloudSite: pairing.site,
          cloudJobId: claim.job._id,
          cloudLeaseId: claim.job.leaseId,
          cloudSequence: claim.job.lastSequence,
          requestedModel: claim.deployment.model,
        },
      );
      this.runner.wake();
      await this.report(j);
      this.lastError = null;
    } catch (e) {
      this.failures++;
      this.nextAttempt =
        Date.now() + Math.min(30000, 1000 * 2 ** this.failures);
      this.lastError = e.message;
      if (e.status === 401) {
        for (const j of this.store.data.jobs.filter(
          (j) => j.cloudJobId && ["running", "queued"].includes(j.status),
        ))
          this.runner.cancel(j.id);
      }
    } finally {
      this.busy = false;
    }
  }
  async report(j) {
    const status =
      j.status === "succeeded"
        ? "completed"
        : j.status === "queued"
          ? "running"
          : j.status;
    const final = ["completed", "failed", "cancelled", "interrupted"].includes(
      status,
    );
    const events = j.events
      .slice(-36)
      .map((e) => ({ tool: e.tool, status: e.status }));
    const eventSignature = JSON.stringify(events);
    const signature = JSON.stringify([
      j.output,
      eventSignature,
      j.rounds,
      j.usage,
      status,
      j.error,
    ]);
    const previous = this.reported.get(j.id);
    const now = Date.now();
    // Batch changed output at 2 seconds; retain cancellation checks and lease renewal
    // at 5 seconds even when inference has not produced any new text.
    if (
      !final &&
      previous &&
      now - previous.at < (signature === previous.signature ? 5000 : 2000)
    )
      return;
    const sequence = (j.cloudSequence || 0) + 1;
    j.cloudSequence = sequence;
    this.store.save();
    const result = await this.request("progress", {
      jobId: j.cloudJobId,
      leaseId: j.cloudLeaseId,
      sequence,
      ...(final || !previous || previous.output !== j.output
        ? { content: j.output }
        : {}),
      ...(!previous || previous.events !== eventSignature ? { events } : {}),
      rounds: j.rounds,
      promptTokens: j.usage.prompt_tokens,
      completionTokens: j.usage.completion_tokens,
      status,
      ...(j.error ? { error: j.error } : {}),
    });
    this.reported.set(j.id, {
      at: now,
      signature,
      output: j.output,
      events: eventSignature,
    });
    if (result.status === "cancelling") this.runner.cancel(j.id);
    if (
      ["completed", "failed", "cancelled", "interrupted"].includes(
        result.status,
      )
    ) {
      if (["running", "queued"].includes(j.status)) this.runner.cancel(j.id);
      this.reported.delete(j.id);
      j.cloudCompleted = true;
      this.store.save();
    }
  }
}
