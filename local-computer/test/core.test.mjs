import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.mjs";
import { Runner, readCompletion } from "../src/runner.mjs";
import { Fleet } from "../src/fleet.mjs";
import { Service } from "../src/service.mjs";

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "akashic-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, store: new Store(dir) };
}
function stream(chunks) {
  return new Response(
    new ReadableStream({
      start(c) {
        for (const s of chunks) c.enqueue(new TextEncoder().encode(s));
        c.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
const event = (delta) =>
  `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
const done = "data: [DONE]\n\n";
const waitForJob = async (job) => {
  for (let i = 0; i < 100 && ["queued", "running"].includes(job.status); i++)
    await new Promise((r) => setTimeout(r, 5));
};
const fleet = {
  models: async () => ({ status: "online", models: [{ id: "test-local" }] }),
  hosts: () => [{ id: "test-device", state: "observed" }],
  inspect: async (id) => ({ id, status: "online" }),
};

test("idempotent submission rejects conflicting payloads and overlapping session work", (t) => {
  const { store } = setup(t);
  const s = store.createSession();
  const job = store.enqueue(s.id, "hello", "request-123", 512);
  assert.equal(store.enqueue(s.id, "hello", "request-123", 512).id, job.id);
  assert.equal(s.messages.length, 1);
  assert.throws(
    () => store.enqueue(s.id, "different", "request-123", 512),
    /different request/,
  );
  assert.throws(
    () => store.enqueue(s.id, "next", "request-456", 512),
    /active job/,
  );
});
test("restart preserves partial evidence without replaying jobs", (t) => {
  const { store, dir } = setup(t);
  const s = store.createSession();
  const j = store.enqueue(s.id, "hi", "request-restart", 512);
  j.status = "running";
  j.output = "partial";
  store.save();
  const reopened = new Store(dir);
  assert.equal(reopened.job(j.id).status, "interrupted");
  assert.equal(reopened.job(j.id).output, "partial");
});
test("stream parser tolerates split SSE lines and tool arguments", async () => {
  const source =
    event({ content: "Hello " }) +
    event({
      tool_calls: [
        {
          index: 0,
          id: "call-1",
          function: { name: "list_models", arguments: "{" },
        },
      ],
    }) +
    event({ tool_calls: [{ index: 0, function: { arguments: "}" } }] }) +
    done;
  const r = await readCompletion(
    stream([source.slice(0, 17), source.slice(17, 60), source.slice(60)]),
    () => {},
  );
  assert.equal(r.text, "Hello ");
  assert.equal(r.calls[0].function.arguments, "{}");
  assert.equal(r.calls[0].id, "call-1");
});
test("truncated stream is not reported as successful", async () => {
  let partial = "";
  await assert.rejects(
    () =>
      readCompletion(
        stream([event({ content: "partial" })]),
        (d) => (partial += d),
      ),
    /before completion/,
  );
  assert.equal(partial, "partial");
});
test("output limit is recorded as a partial failed job, not a complete answer", async (t) => {
  const { store } = setup(t);
  const s = store.createSession();
  const j = store.enqueue(s.id, "long answer", "request-length", 128);
  const runner = new Runner(
    store,
    fleet,
    { endpoint: "http://local/v1" },
    async () =>
      stream([
        event({ content: "incomplete" }),
        'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
        done,
      ]),
  );
  runner.wake();
  await waitForJob(j);
  assert.equal(j.status, "failed");
  assert.match(j.error, /output limit/);
  assert.equal(s.messages.at(-1).partial, true);
});
test("direct local answer persists without any agent tools", async (t) => {
  const { store } = setup(t);
  const s = store.createSession();
  const j = store.enqueue(s.id, "hi", "request-chat", 512);
  const runner = new Runner(
    store,
    fleet,
    { endpoint: "http://local/v1" },
    async (url, opts) => {
      const body = JSON.parse(opts.body);
      assert.equal(body.tools, undefined);
      assert.equal(url, "http://local/v1/chat/completions");
      return stream([event({ content: "local answer" }), done]);
    },
  );
  runner.wake();
  await waitForJob(j);
  assert.equal(j.status, "succeeded");
  assert.equal(s.messages.at(-1).content, "local answer");
});
test("local agent executes read-only tool then produces a final answer", async (t) => {
  const { store } = setup(t);
  const s = store.createSession("test", "agent");
  const j = store.enqueue(s.id, "inspect", "request-agent", 512);
  let rounds = 0;
  const runner = new Runner(
    store,
    fleet,
    { endpoint: "http://local/v1" },
    async (url, opts) => {
      const body = JSON.parse(opts.body);
      assert.equal(body.tools.length, 3);
      if (rounds++ === 0)
        return stream([
          event({
            tool_calls: [
              {
                index: 0,
                id: "call-1",
                function: {
                  name: "inspect_device",
                  arguments: '{"device_id":"test-device"}',
                },
              },
            ],
          }),
          'data: {"usage":{"prompt_tokens":10,"completion_tokens":20},"choices":[]}\n\n',
          done,
        ]);
      assert.equal(body.messages.at(-1).role, "tool");
      assert.match(body.messages.at(-1).content, /online/);
      return stream([event({ content: "Device online" }), done]);
    },
  );
  runner.wake();
  await waitForJob(j);
  assert.equal(j.status, "succeeded");
  assert.equal(j.rounds, 2);
  assert.equal(j.events[0].tool, "inspect_device");
});
test("unknown tools cannot become shell execution", async (t) => {
  const { store } = setup(t);
  const runner = new Runner(store, fleet, {});
  await assert.rejects(
    () =>
      runner.executeTool({
        function: { name: "run_shell", arguments: '{"command":"whoami"}' },
      }),
    /not permitted/,
  );
});
test("cancelled queued jobs do not call inference", async (t) => {
  const { store } = setup(t);
  const s = store.createSession();
  const j = store.enqueue(s.id, "hi", "request-cancel", 512);
  let calls = 0;
  const runner = new Runner(store, fleet, {}, async () => {
    calls++;
  });
  runner.cancel(j.id);
  runner.wake();
  assert.equal(j.status, "cancelled");
  assert.equal(calls, 0);
});
test("model failure is explicit, with no alternate provider", async (t) => {
  const { store } = setup(t);
  const s = store.createSession();
  const j = store.enqueue(s.id, "hi", "request-offline", 512);
  let calls = 0;
  const runner = new Runner(
    store,
    { models: async () => ({ status: "unreachable", models: [] }) },
    {},
    async () => {
      calls++;
    },
  );
  runner.wake();
  await waitForJob(j);
  assert.equal(j.status, "failed");
  assert.match(j.error, /No cloud fallback/);
  assert.equal(calls, 0);
});
test("cancelling active inference releases the queue and preserves terminal state", async (t) => {
  const { store } = setup(t);
  const first = store.enqueue(
    store.createSession().id,
    "first",
    "cancel-running",
    512,
  );
  const second = store.enqueue(
    store.createSession().id,
    "second",
    "after-cancel",
    512,
  );
  let calls = 0;
  const runner = new Runner(
    store,
    fleet,
    { endpoint: "http://local/v1" },
    async (url, opts) => {
      calls++;
      if (calls === 1)
        return new Promise((resolve, reject) =>
          opts.signal.addEventListener(
            "abort",
            () => reject(new Error("Aborted")),
            { once: true },
          ),
        );
      return stream([event({ content: "second result" }), done]);
    },
  );
  runner.wake();
  for (let i = 0; i < 50 && !calls; i++)
    await new Promise((r) => setTimeout(r, 2));
  runner.cancel(first.id);
  await waitForJob(second);
  assert.equal(first.status, "cancelled");
  assert.equal(second.status, "succeeded");
  assert.equal(calls, 2);
});
test("planned and retired inventory never invokes SSH", async (t) => {
  const { dir } = setup(t);
  mkdirSync(join(dir, "inventory"));
  writeFileSync(
    join(dir, "inventory/hosts.json"),
    JSON.stringify({
      hosts: [
        { id: "old", state: "observed", ssh_alias: "DO-NOT-CONNECT" },
        { id: "future", state: "planned", ssh_alias: null },
      ],
    }),
  );
  const f = new Fleet({
    fleetRoot: dir,
    hostOverrides: { old: { state: "retired", ssh_alias: null } },
  });
  assert.equal((await f.inspect("old")).status, "retired");
  assert.equal((await f.inspect("future")).status, "planned");
  await assert.rejects(() => f.inspect("unknown"), /Unknown fleet host/);
});
test("service validates limits and delegation retries", async (t) => {
  const { store } = setup(t);
  const api = new Service(store, fleet, { wake() {} });
  await assert.rejects(() =>
    api.call("delegate_task", {
      brief: "x",
      idempotency_key: "request-service",
      max_tokens: 99999,
    }),
  );
  const a = {
    brief: "inspect",
    idempotency_key: "request-service",
    max_tokens: 512,
  };
  const r = await api.call("delegate_task", a);
  const retry = await api.call("delegate_task", a);
  assert.equal(r.jobId, retry.jobId);
  assert.equal(store.data.sessions.length, 1);
  await assert.rejects(
    () => api.call("arbitrary_executor", {}),
    /Unknown operation/,
  );
});
