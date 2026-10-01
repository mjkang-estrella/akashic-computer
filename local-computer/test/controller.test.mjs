import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Fleet } from "../src/fleet.mjs";
import { Store } from "../src/store.mjs";
import { Service } from "../src/service.mjs";
import { CloudRelay } from "../src/cloud.mjs";
import { systemdUnit } from "../src/systemd-unit.mjs";
function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(), "akashic-controller-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
test("Linux controller observes itself locally once and never invents a Mac", async (t) => {
  const dir = temporary(t);
  mkdirSync(join(dir, "inventory"));
  writeFileSync(
    join(dir, "inventory/hosts.json"),
    JSON.stringify({
      hosts: [
        {
          id: "mj-zima",
          state: "observed",
          ssh_alias: "mj-zima",
          role: "controller",
        },
        { id: "retired", state: "retired", ssh_alias: null },
      ],
    }),
  );
  let probes = 0;
  const fleet = new Fleet(
    { fleetRoot: dir, controllerDeviceId: "mj-zima" },
    {
      platform: "linux",
      execute: async (cmd, args) => {
        probes++;
        assert.equal(cmd, "python3");
        assert.equal(args[0], "-c");
        return {
          stdout: JSON.stringify({
            hostname: "mj-zima",
            failedUnits: "old.service failed",
          }),
        };
      },
    },
  );
  const result = await fleet.snapshot();
  assert.equal(probes, 1);
  assert.deepEqual(
    result.hosts.map((h) => h.id),
    ["mj-zima", "retired"],
  );
  assert.equal(result.hosts[0].status, "degraded");
  assert.equal(result.hosts[1].status, "retired");
});
test("client-only mode never probes, claims, or runs inference but retains local history", async (t) => {
  const store = new Store(temporary(t));
  const session = store.createSession("Legacy");
  const forbidden = () => {
    throw new Error("must not execute");
  };
  const fleet = { snapshot: forbidden, models: forbidden };
  const runner = { wake: forbidden };
  const config = { relayEnabled: false };
  const relay = new CloudRelay(store, fleet, runner, config, {
    paired: () => true,
    request: forbidden,
  });
  await relay.tick();
  const calls = [];
  const api = new Service(store, fleet, runner, config, {
    paired: () => ({ site: "https://example.test" }),
    request: async (op, args) => {
      calls.push({ op, args });
      return { jobId: "cloud:abc123", status: "queued" };
    },
  });
  assert.equal((await api.call("get_connection", {})).clientOnly, true);
  assert.equal((await api.call("list_sessions", {}))[0].id, session.id);
  assert.deepEqual((await api.call("get_overview", {})).hosts, []);
  await assert.rejects(
    () =>
      api.call("send_message", {
        session_id: session.id,
        text: "x",
        idempotency_key: "test-key",
      }),
    /read-only/,
  );
  await assert.rejects(() => api.call("create_session", {}), /client/);
  const job = await api.call("delegate_task", {
    brief: "Inspect Zima",
    idempotency_key: "delegate-key",
  });
  assert.equal(job.jobId, "cloud:abc123");
  assert.equal(calls[0].args.operation, "delegate");
  await api.call("get_job", { job_id: job.jobId });
  assert.equal(calls[1].args.jobId, "abc123");
  await api.call("cancel_job", { job_id: job.jobId });
  assert.equal(calls[2].args.operation, "cancel");
  assert.equal(store.data.jobs.length, 0);
});
test("systemd paths cannot inject directives and percent specifiers stay literal", () => {
  const args = {
    node: "/usr/bin/node",
    entry: "/srv/project 100%/dist/controller.cjs",
    root: "/srv/project 100%",
    stateDir: "/home/user/private",
  };
  const unit = systemdUnit(args);
  assert.match(unit, /project 100%%/);
  assert.match(unit, /^WorkingDirectory=\/srv\/project 100%%$/m);
  assert.match(unit, /UMask=0077/);
  assert.match(unit, /WantedBy=default.target/);
  assert.throws(
    () => systemdUnit({ ...args, stateDir: "/tmp\nExecStart=bad" }),
    /Invalid service path/,
  );
});
