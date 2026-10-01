import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import { inventory } from "./config.mjs";
const exec = promisify(execFile);

// Fixed read-only probe. No model-generated code, shell commands, paths, or URLs.
const probe = `import json,os,platform,subprocess,datetime
def run(args):
 try:
  p=subprocess.run(args,capture_output=True,text=True,timeout=5)
  return p.stdout.strip()[:5000] if p.returncode==0 else 'unavailable'
 except Exception: return 'unavailable'
mem={}
try:
 for line in open('/proc/meminfo'):
  k=line.split(':')[0]
  if k in ['MemTotal','MemAvailable']: mem[k]=int(line.split()[1])*1024
except Exception: pass
print(json.dumps({'hostname':platform.node(),'os':platform.system(),'architecture':platform.machine(),'memory':mem,'load':list(os.getloadavg()),'uptime':run(['uptime','-p']),'disks':run(['df','-h','/']),'gpu':run(['nvidia-smi','--query-gpu=name,utilization.gpu,temperature.gpu','--format=csv,noheader']),'containers':run(['docker','ps','--format','{{.Names}} | {{.Status}}']),'failedUnits':run(['systemctl','--failed','--no-pager','--no-legend','--plain'])}))`;

export class Fleet {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.pending = new Map();
  }
  hosts() {
    return inventory(this.config);
  }
  async inspect(id, fresh = false) {
    if (id === "local-mac")
      return {
        id,
        status: "online",
        observedAt: new Date().toISOString(),
        hostname: os.hostname(),
        os: os.platform(),
        architecture: os.arch(),
        memory: { MemTotal: os.totalmem(), MemAvailable: os.freemem() },
        load: os.loadavg(),
        uptime: `${Math.round(os.uptime() / 3600)} hours`,
        role: "controller",
      };
    const host = this.hosts().find((h) => h.id === id);
    if (!host) throw new Error("Unknown fleet host");
    if (host.state !== "observed" || !host.ssh_alias)
      return { ...host, status: host.state, observedAt: null };
    if (
      !fresh &&
      this.cache.has(id) &&
      Date.now() - this.cache.get(id).at < 30000
    )
      return this.cache.get(id).value;
    if (this.pending.has(id)) return this.pending.get(id);
    const task = (async () => {
      let value;
      try {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(host.ssh_alias))
          throw new Error("Invalid SSH alias");
        const args = [
          "-o",
          "BatchMode=yes",
          "-o",
          "ConnectTimeout=5",
          "-o",
          "StrictHostKeyChecking=yes",
          "-o",
          "ServerAliveInterval=5",
          "-o",
          "ServerAliveCountMax=1",
        ];
        if (host.lanAddress) {
          if (!/^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/.test(host.lanAddress))
            throw new Error("Invalid LAN address");
          args.push("-o", `HostName=${host.lanAddress}`);
        }
        args.push(
          host.ssh_alias,
          "python3",
          "-c",
          "'" + probe.replaceAll("'", "'\\''") + "'",
        );
        const { stdout } = await exec("ssh", args, {
          timeout: 30000,
          maxBuffer: 100000,
        });
        const data = JSON.parse(stdout);
        value = {
          ...host,
          ...data,
          status:
            data.failedUnits && data.failedUnits !== "unavailable"
              ? "degraded"
              : "online",
          observedAt: new Date().toISOString(),
        };
      } catch {
        value = {
          ...host,
          status: "unreachable",
          observedAt: new Date().toISOString(),
          error:
            "SSH observation failed. Check LAN address, trusted host key, and credentials.",
        };
      }
      this.cache.set(id, { at: Date.now(), value });
      return value;
    })().finally(() => this.pending.delete(id));
    this.pending.set(id, task);
    return task;
  }
  async snapshot(fresh = false) {
    const hosts = await Promise.all([
      ...this.hosts().map((h) => this.inspect(h.id, fresh)),
      this.inspect("local-mac"),
    ]);
    return {
      hosts,
      capturedAt: new Date().toISOString(),
      source: this.config.fleetRoot,
      note: "Inventory roles are imported; health is observed. Local overrides supersede the inventory baseline.",
    };
  }
  async models() {
    try {
      const r = await fetch(
        this.config.endpoint.replace(/\/$/, "") + "/models",
        {
          signal: AbortSignal.timeout(5000),
          redirect: "error",
          headers:
            this.config.apiKeyEnv && process.env[this.config.apiKeyEnv]
              ? {
                  Authorization: `Bearer ${process.env[this.config.apiKeyEnv]}`,
                }
              : {},
        },
      );
      if (!r.ok) throw new Error();
      const body = await r.json();
      return {
        status: "online",
        models: body.data.map((m) => ({ id: m.id, owner: m.owned_by })),
        endpoint: this.config.endpoint,
        configuredModel: this.config.model,
        observedAt: new Date().toISOString(),
      };
    } catch {
      return {
        status: "unreachable",
        models: [],
        endpoint: this.config.endpoint,
        configuredModel: this.config.model,
        observedAt: new Date().toISOString(),
      };
    }
  }
}
