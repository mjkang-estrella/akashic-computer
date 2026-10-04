"use client";
import { useState } from "react";
import { computerSchema, computerTemplates, decimalGbToBytes, type ComputerProfile, type WorkloadProfile } from "@/lib/atlas/deployments";
import { memoryBytesLabel } from "@/lib/atlas/memory";
export function ComputerEditor({ profile, onChange }: { profile: ComputerProfile; onChange: (p: ComputerProfile) => void }) {
  const pool = profile.pools[0];
  const updateMemory = (field: "capacityBytes" | "usableBytes" | "accessibleBytes", text: string) => {
    const first = pool ?? { id: "memory", label: "System memory", kind: "host" as const, deviceIds: [] };
    onChange({ ...profile, source: "manual", pools: [{ ...first, [field]: text ? Math.round(Number(text) * 2 ** 30) : undefined }, ...profile.pools.slice(1)] });
  };
  return <fieldset className="comparison-fields">
    <legend className="font-semibold">Computer</legend>
    <label>Start from a template<select value="" onChange={(e) => onChange(structuredClone(computerTemplates[e.target.value]))}>
      <option value="" disabled>Choose hardware class</option><option value="generic">Memory budget only</option>
      <option value="framework">Framework Desktop</option><option value="spark">DGX Spark</option>
    </select></label>
    <label>Name<input value={profile.name} maxLength={200} onChange={(e) => onChange({ ...profile, name: e.target.value })} /></label>
    <label>Platform<select value={profile.platform} onChange={(e) => onChange({ ...profile, platform: e.target.value as ComputerProfile["platform"], source: "manual" })}>
      {["unknown", "linux-x64", "linux-arm64", "mac-arm64", "windows-x64"].map((p) => <option key={p}>{p}</option>)}
    </select></label>
    {(["capacityBytes", "usableBytes", "accessibleBytes"] as const).map((key, i) =>
      <label key={key}>{["Physical capacity (GiB)", "Usable system memory (GiB)", "GPU-addressable limit (GiB)"][i]}
        <input type="number" min="0" step="0.01" placeholder="Unknown" value={pool?.[key] === undefined ? "" : pool[key]! / 2 ** 30}
          onChange={(e) => updateMemory(key, e.target.value)} />
        <span className="text-xs text-muted">{memoryBytesLabel(pool?.[key])}</span>
      </label>)}
    <label>Memory pool<select value={pool?.kind ?? "host"} onChange={(e) => onChange({ ...profile, source: "manual",
      pools: [{ ...(pool ?? { id: "memory", label: "Memory", deviceIds: [] }), kind: e.target.value as "host" | "unified" | "device" }, ...profile.pools.slice(1)] })}>
      <option value="host">Host RAM</option><option value="unified">Unified/shared</option><option value="device">Discrete GPU</option>
    </select></label>
    <label>Topology<input value={profile.topology ?? ""} maxLength={500} placeholder="Unknown" onChange={(e) => onChange({ ...profile, topology: e.target.value || undefined, source: "manual" })} /></label>
    <label>CPU<input value={profile.cpu ?? ""} onChange={(e) => onChange({ ...profile, cpu: e.target.value || undefined, source: "manual" })} /></label>
    <fieldset className="col-span-full"><legend>Available backends</legend><div className="flex flex-wrap gap-4">
      {(["vulkan", "cuda", "rocm", "metal", "cpu"] as const).map((backend) => <label className="flex min-h-11 items-center gap-2" key={backend}>
        <input type="checkbox" checked={profile.backends.includes(backend)} onChange={(e) => onChange({ ...profile, source: "manual",
          backends: e.target.checked ? [...profile.backends, backend] : profile.backends.filter((b) => b !== backend) })} />{backend}
      </label>)}
    </div></fieldset>
    {(["os", "kernel", "driver", "powerProfile"] as const).map((key) => <label key={key}>{key === "powerProfile" ? "Power profile" : key}
      <input value={profile.environment?.[key] ?? ""} placeholder="Unknown" onChange={(e) => onChange({ ...profile, source: "manual", environment: { ...profile.environment, [key]: e.target.value || undefined } })} />
    </label>)}
    <AdvancedComputer key={JSON.stringify(profile)} profile={profile} onChange={onChange} />
    <p className="col-span-full text-xs text-muted">Templates describe a hardware class. Enter your own memory limits; shared pools are not added together.</p>
  </fieldset>;
}
function AdvancedComputer({ profile, onChange }: { profile: ComputerProfile; onChange: (p: ComputerProfile) => void }) {
  const [text, setText] = useState(JSON.stringify(profile, null, 2)), [error, setError] = useState("");
  return <details className="col-span-full"><summary className="min-h-11 cursor-pointer py-3">Multiple devices and memory pools</summary>
    <p className="my-2 text-xs text-muted">Edit the complete profile as JSON for multiple GPUs or nodes. Device IDs link pools to devices; shared memory appears once.</p>
    <label>Computer profile JSON<textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} /></label>
    <button className="comparison-button mt-2" onClick={() => { try { onChange(computerSchema.parse(JSON.parse(text))); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Invalid profile"); } }}>Apply profile JSON</button>
    {error ? <p role="alert" className="text-xs">{error}</p> : null}
  </details>;
}
export function WorkloadEditor({ profile, onChange }: { profile: WorkloadProfile; onChange: (p: WorkloadProfile) => void }) {
  return <fieldset className="comparison-fields">
    <legend className="font-semibold">Workload and constraints</legend>
    <label>Name<input value={profile.name} maxLength={200} onChange={(e) => onChange({ ...profile, name: e.target.value })} /></label>
    <label>Task focus<select value={profile.taskFocus} onChange={(e) => onChange({ ...profile, taskFocus: e.target.value as WorkloadProfile["taskFocus"] })}>
      {["general", "coding", "reasoning", "long-context", "other"].map((s) => <option key={s}>{s}</option>)}
    </select></label>
    <label>Total memory ceiling (GB)<input type="number" min="1" step="1" value={profile.totalMemoryBytes / 1e9}
      onChange={(e) => { if (Number(e.target.value) > 0) onChange({ ...profile, totalMemoryBytes: decimalGbToBytes(e.target.value) }); }} /><span className="text-xs text-muted">{memoryBytesLabel(profile.totalMemoryBytes)}</span></label>
    <label>Target context (tokens)<input type="number" min="1" value={profile.contextTokens}
      onChange={(e) => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n > 0 && n <= 16777216) onChange({ ...profile, contextTokens: n }); }} /></label>
    <label>Concurrency<input type="number" min="1" max="256" value={profile.concurrency} onChange={(e) => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n > 0 && n <= 256) onChange({ ...profile, concurrency: n }); }} /></label>
    <label>Thinking<select value={profile.thinking} onChange={(e) => onChange({ ...profile, thinking: e.target.value as WorkloadProfile["thinking"] })}>
      <option value="on">On</option><option value="off">Off</option><option value="unknown">Unknown</option>
    </select></label>
    <label>OS / other-use reserve (GB)<input type="number" min="0" step="0.1" placeholder="Unknown" value={profile.reserveBytes === undefined ? "" : profile.reserveBytes / 1e9}
      onChange={(e) => onChange({ ...profile, reserveBytes: e.target.value ? decimalGbToBytes(e.target.value) : undefined })} /><span className="text-xs text-muted">{memoryBytesLabel(profile.reserveBytes)}</span></label>
    <label>Desired decode (tok/s)<input type="number" min="0.1" step="0.1" placeholder="Optional" value={profile.desiredDecodeTps ?? ""}
      onChange={(e) => onChange({ ...profile, desiredDecodeTps: e.target.value ? Number(e.target.value) : undefined })} /></label>
    <label>Desired TTFT (seconds)<input type="number" min="0.01" step="0.01" placeholder="Optional" value={profile.desiredTtftSeconds ?? ""}
      onChange={(e) => onChange({ ...profile, desiredTtftSeconds: e.target.value ? Number(e.target.value) : undefined })} /></label>
  </fieldset>;
}
