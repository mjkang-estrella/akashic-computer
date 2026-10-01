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
