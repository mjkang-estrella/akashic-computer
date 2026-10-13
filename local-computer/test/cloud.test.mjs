import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.mjs";
import { CloudRelay } from "../src/cloud.mjs";
function setup(t, request) {
  const dir = mkdtempSync(join(tmpdir(), "akashic-cloud-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  const runner = {
    active: null,
    wakes: 0,
    wake() {
      this.wakes++;
    },
    cancel(id) {
      store.job(id).status = "cancelled";
    },
  };
  const fleet = {
    models: async () => ({ status: "online", models: [{ id: "local-model" }] }),
    snapshot: async () => ({ hosts: [] }),
  };
  const relay = new CloudRelay(
    store,
    fleet,
    runner,
    {},
    { request, paired: () => true },
  );
  relay.lastHeartbeat = Date.now();
  return { store, runner, relay };
}
const claim = {
  job: {
    _id: "cloud-job",
    prompt: "hello",
    maxTokens: 512,
    leaseId: "lease",
    lastSequence: 0,
  },
  conversation: { _id: "conversation", title: "Cloud", mode: "chat" },
  deployment: { model: "local-model" },
  messages: [{ role: "user", content: "hello" }],
  reconcile: false,
};
test("cloud dispatch persists identity before starting and does not duplicate on reconnect", async (t) => {
  let claims = 0;
  const { store, relay, runner } = setup(t, async (op) => {
    if (op === "claim") {
      claims++;
      return claim;
    }
    return { status: "running" };
  });
  await relay.tick();
  assert.equal(runner.wakes, 1);
  assert.equal(store.data.jobs.length, 1);
  assert.equal(store.data.jobs[0].cloudJobId, "cloud-job");
  await relay.tick();
  assert.equal(claims, 1);
  assert.equal(runner.wakes, 1);
  assert.equal(store.data.sessions[0].messages.length, 1);
});
test("ambiguous cloud lease without local receipt is interrupted, never replayed", async (t) => {
  const calls = [];
  const { relay, runner } = setup(t, async (op, args) => {
    calls.push({ op, args });
    return op === "claim"
      ? { ...claim, reconcile: true }
      : { status: "interrupted" };
  });
  await relay.tick();
  assert.equal(runner.wakes, 0);
  assert.equal(calls.at(-1).args.status, "interrupted");
});
test("cloud cancellation is propagated to active local job", async (t) => {
  const { store, relay } = setup(t, async (op) =>
    op === "claim" ? claim : { status: "cancelling" },
  );
  await relay.tick();
  assert.equal(store.data.jobs[0].status, "cancelled");
});
test("revoked connector stops its local cloud work but preserves unrelated local jobs", async (t) => {
  const { store, relay } = setup(t, async () => {
    const e = new Error("revoked");
    e.status = 401;
    throw e;
  });
  const local = store.enqueue(
    store.createSession().id,
    "local",
    "local-key",
    512,
  );
  const remote = store.enqueue(
    store.createSession().id,
    "remote",
    "remote-key",
    512,
    { cloudJobId: "cloud", cloudLeaseId: "lease" },
  );
  await relay.tick();
  assert.equal(remote.status, "cancelled");
  assert.equal(local.status, "queued");
  assert.ok(relay.nextAttempt > Date.now());
});
test("a native local job blocks cloud claims until the shared runner is free", async (t) => {
  let called = 0;
  const { relay, runner } = setup(t, async () => {
    called++;
    return claim;
  });
  runner.active = { id: "native" };
  await relay.tick();
  assert.equal(called, 0);
});

test("unchanged inventories become presence-only heartbeats and failures retry inventory", async (t) => {
  const calls = [];
  let fail = false;
  const { relay, runner } = setup(t, async (op, args) => {
    calls.push({ op, args });
    if (fail) throw new Error("offline");
    return { connectorId: "connector" };
  });
  runner.active = { id: "local" };
  relay.lastHeartbeat = 0;
  await relay.tick();
  assert.ok(calls[0].args.deployments);
  relay.lastHeartbeat = 0;
  await relay.tick();
  assert.equal(calls[1].args.deployments, undefined);
  assert.equal(calls[1].args.devices, undefined);
  relay.fleet.models = async () => ({ status: "online", models: [{ id: "changed" }] });
  relay.lastHeartbeat = 0;
  fail = true;
  await relay.tick();
  fail = false;
  relay.nextAttempt = 0;
  await relay.tick();
  assert.equal(calls.at(-1).args.deployments[0].model, "changed");
});

test("progress batches changed text, omits unchanged output on keepalive, and flushes completion", async (t) => {
  const calls = [];
  const { relay, store } = setup(t, async (op, args) => {
    calls.push({ op, args });
    return { status: args.status };
  });
  const job = store.enqueue(store.createSession().id, "hi", "batch-test", 512,
    { cloudJobId: "job", cloudLeaseId: "lease" });
  job.status = "running";
  job.output = "first";
  await relay.report(job);
  job.output = "first second";
  await relay.report(job);
  assert.equal(calls.length, 1);
  relay.reported.get(job.id).at -= 2000;
  await relay.report(job);
  assert.equal(calls[1].args.content, "first second");
  relay.reported.get(job.id).at -= 5000;
  await relay.report(job);
  assert.equal(calls[2].args.content, undefined);
  assert.equal(calls[2].args.events, undefined);
  job.status = "succeeded";
  await relay.report(job);
  assert.equal(calls[3].args.content, "first second");
  assert.equal(calls[3].args.status, "completed");
  assert.equal(job.cloudCompleted, true);
});

test("a failed progress report does not acknowledge output", async (t) => {
  let fail = true;
  const calls = [];
  const { relay, store } = setup(t, async (op, args) => {
    calls.push({ op, args });
    if (fail) throw new Error("offline");
    return { status: args.status };
  });
  const job = store.enqueue(store.createSession().id, "hi", "retry-test", 512,
    { cloudJobId: "job", cloudLeaseId: "lease" });
  job.status = "running";
  job.output = "full output";
  await assert.rejects(relay.report(job), /offline/);
  fail = false;
  await relay.report(job);
  assert.equal(calls[1].args.content, "full output");
  assert.ok(calls[1].args.sequence > calls[0].args.sequence);
});
