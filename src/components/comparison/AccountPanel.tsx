"use client";
import Link from "next/link";
import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { computerTemplates, defaultWorkload, type ComputerProfile, type WorkloadProfile } from "@/lib/atlas/deployments";
import { ComputerEditor, WorkloadEditor } from "./ProfileEditors";
import { EvidenceLibrary } from "./EvidenceLibrary";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDeploymentComparison } from "./ComparisonProvider";

export function SignInComparison() {
  const { signIn } = useAuthActions(), [error, setError] = useState("");
  const policy = useQuery(api.workspace.accessPolicy);
  const { selections } = useDeploymentComparison();
  return <div className="my-5 border-y border-line py-5">
    <h2>Keep your decision</h2>
    <p className="my-3 text-sm text-muted">Sign in to save computers, constraints, evidence, and comparisons. A controller is optional.</p>
    <button className="comparison-button comparison-primary" onClick={() => {
      const params = new URLSearchParams(window.location.search);
      if (window.location.pathname === "/compare" && selections.length) {
        params.delete("build");
        for (const s of selections) params.append("build", s.build.key);
      }
      void signIn("github", { redirectTo: window.location.pathname + (params.size ? "?" + params : "") }).catch((e) => setError(e.message));
    }}>Continue with GitHub</button>
    {selections.length ? <p className="mt-3 text-xs text-muted">Your public file shortlist follows sign-in. Sign in before editing personal constraints and notes.</p> : null}
    {policy?.signup === "single_owner" ? <p className="mt-3 text-xs text-muted">This installation currently limits account access to its configured owner.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
export function AccountPanel({ applyComputer, applyWorkload }: {
  applyComputer: (profile: ComputerProfile) => void; applyWorkload: (profile: WorkloadProfile) => void;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <p role="status">Checking your account…</p>;
  return isAuthenticated ? <SavedWorkspace applyComputer={applyComputer} applyWorkload={applyWorkload} /> : <SignInComparison />;
}
function SavedWorkspace({ applyComputer, applyWorkload }: {
  applyComputer: (p: ComputerProfile) => void; applyWorkload: (p: WorkloadProfile) => void;
}) {
  const profiles = useQuery(api.comparisons.profiles), saved = useQuery(api.comparisons.list);
  const saveComputer = useMutation(api.comparisons.saveComputer), saveWorkload = useMutation(api.comparisons.saveWorkload),
    remove = useMutation(api.comparisons.remove);
  const [computer, setComputer] = useState<ComputerProfile>(computerTemplates.framework);
  const [workload, setWorkload] = useState<WorkloadProfile>(defaultWorkload);
  const [computerId, setComputerId] = useState<Id<"computerProfiles">>();
  const [workloadId, setWorkloadId] = useState<Id<"workloadProfiles">>();
  const [message, setMessage] = useState("");
  async function act(fn: () => Promise<unknown>) {
    try { await fn(); setMessage("Saved. Existing comparison snapshots stay unchanged."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not save."); }
  }
  return <section className="my-8" aria-label="Your saved workspace">
    <h2>Your saved work</h2>
    <p className="my-3 text-sm text-muted">Private to your GitHub account. Profiles can be entered manually without connecting a computer.</p>
    <ul className="my-3 space-y-2">{saved?.map((s) => <li key={s.id} className="flex flex-wrap items-center gap-3">
      <Link className="underline" href={"/compare/" + s.id}>{s.name}</Link>
      <button className="comparison-button" onClick={() => void act(() => remove({ id: s.id }))}>Delete comparison</button>
    </li>)}</ul>
    <details className="my-4 border-t border-line py-4"><summary className="min-h-11 cursor-pointer font-semibold">Saved computers and workloads</summary>
      <div className="my-3 flex flex-wrap gap-2">{profiles?.computers.map((p) => <div key={p.id} className="flex gap-1">
        <button className="comparison-button" onClick={() => applyComputer(p.profile)}>Use {p.profile.name}</button>
        <button className="comparison-button" onClick={() => { setComputer(p.profile); setComputerId(p.id); }}>Edit</button>
        <button className="comparison-button" onClick={() => void act(() => remove({ id: p.id }))}>Delete</button>
      </div>)}</div>
      <ComputerEditor profile={computer} onChange={setComputer} />
      <div className="flex flex-wrap gap-2">
        <button className="comparison-button" onClick={() => void act(async () => { const id = await saveComputer({ id: computerId, profile: computer }); setComputerId(id); })}>{computerId ? "Update computer profile" : "Save computer profile"}</button>
        <button className="comparison-button" onClick={() => { setComputerId(undefined); setComputer(computerTemplates.generic); }}>New computer profile</button>
      </div>
      <div className="my-5 flex flex-wrap gap-2">{profiles?.workloads.map((p) => <div key={p.id} className="flex gap-1">
        <button className="comparison-button" onClick={() => applyWorkload(p.profile)}>Use {p.profile.name}</button>
        <button className="comparison-button" onClick={() => { setWorkload(p.profile); setWorkloadId(p.id); }}>Edit</button>
        <button className="comparison-button" onClick={() => void act(() => remove({ id: p.id }))}>Delete</button>
      </div>)}</div>
      <WorkloadEditor profile={workload} onChange={setWorkload} />
      <div className="flex flex-wrap gap-2">
        <button className="comparison-button" onClick={() => void act(async () => { const id = await saveWorkload({ id: workloadId, profile: workload }); setWorkloadId(id); })}>{workloadId ? "Update workload profile" : "Save workload profile"}</button>
        <button className="comparison-button" onClick={() => { setWorkloadId(undefined); setWorkload(defaultWorkload); }}>New workload profile</button>
      </div>
      {message ? <p role="status" className="comparison-status">{message}</p> : null}
    </details>
    <EvidenceLibrary />
  </section>;
}
