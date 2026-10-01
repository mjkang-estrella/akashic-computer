"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Workspace } from "./Workspace";

export function CloudWorkspace({ view }: { view: "work" | "computers" }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [error, setError] = useState("");
  if (isLoading)
    return <p className="p-8 text-muted">Checking your account…</p>;
  if (!isAuthenticated)
    return (
      <section className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-[25px] font-semibold">
          Your models. Your computers.
        </h1>
        <p className="my-5 text-[13px] text-muted">
          Sign in to Akashic Computer to connect your fleet and continue your
          local-model conversations. Prompts and results sync through Convex;
          inference runs on your hardware.
        </p>
        <button
          className="rounded-[7px] bg-ink px-4 py-3 text-[13px] text-paper"
          onClick={() =>
            void signIn("github", {
              redirectTo: window.location.pathname,
            }).catch((e) => setError(e.message))
          }
        >
          Continue with GitHub
        </button>
        <p className="mt-4 text-[11px] text-muted">
          Personal pilot. Access is limited to the configured owner account.
        </p>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  return <SignedInWorkspace view={view} />;
}
function SignedInWorkspace({ view }: { view: "work" | "computers" }) {
  const search = useSearchParams();
  const router = useRouter();
  const id = search.get("conversation") as Id<"conversations"> | null;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const overview = useQuery(api.workspace.overview);
  const sessions = useQuery(api.workspace.listConversations);
  const current = useQuery(api.workspace.getConversation, id ? { id } : "skip");
  const pending = useQuery(api.workspace.pendingEnrollment);
  const create = useMutation(api.workspace.createConversation);
  const send = useMutation(api.workspace.submitJob);
  const cancel = useMutation(api.workspace.cancelJob);
  const enroll = useMutation(api.workspace.beginEnrollment);
  const approve = useMutation(api.workspace.approveEnrollment);
  const revoke = useMutation(api.workspace.revokeConnector);
  async function begin() {
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const code = Array.from(bytes, (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(code),
      );
      await enroll({
        codeHash: Array.from(new Uint8Array(hash), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      });
      setCode(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start connection");
    }
  }
  const site =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ||
    "";
  const panel = (
    <div className="ac-connect">
      <h2>Connect a computer</h2>
      <p>
        The controller connects outward to your account and imports its
        configured fleet. SSH keys and endpoint credentials stay on that
        computer.
      </p>
      <p className="ac-muted">
        New account conversations, outputs, and progress are stored in Convex.
        Existing device-only conversations are not uploaded.
      </p>
      <button className="ac-secondary" onClick={() => void begin()}>
        Create connection code
      </button>
      {code && (
        <>
          <p>On the controller, from the local-computer directory, run:</p>
          <code>
            npm run connect -- --site {site} --code {code}
          </code>
          <p className="ac-muted">
            Code expires after ten minutes. Confirm the computer below after
            running the command.
          </p>
        </>
      )}
      {pending?.ready && (
        <p>
          <strong>{pending.name}</strong> is requesting access.{" "}
          <button
            className="ac-primary"
            onClick={() =>
              void approve({ codeHash: pending.codeHash }).catch((e) =>
                setError(e.message),
              )
            }
          >
            Connect this computer
          </button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
  return (
    <Workspace
      preferredDeploymentId={search.get("deployment") || undefined}
      view={view}
      loading={!overview || !sessions}
      sessions={(sessions || []).map((s) => ({
        id: s._id,
        title: s.title,
        mode: s.mode,
        deploymentId: s.deploymentId,
      }))}
      current={
        current
          ? {
              id: current.conversation._id,
              title: current.conversation.title,
              mode: current.conversation.mode,
              deploymentId: current.conversation.deploymentId,
            }
          : null
      }
      messages={(current?.messages || []).map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        partial: m.partial,
      }))}
      jobs={(current?.jobs || []).map((j) => ({
        id: j._id,
        status: j.status,
        error: j.error,
        rounds: j.rounds,
        completionTokens: j.completionTokens,
        leaseUntil: j.leaseUntil,
        output: current?.progress.find((p) => p.jobId === j._id)?.content,
        events: current?.progress.find((p) => p.jobId === j._id)?.events,
      }))}
      devices={(overview?.devices || []).map((d) => ({
        id: d._id,
        name: d.name,
        role: d.role,
        state: d.state,
        status: d.status,
        connectorId: d.connectorId,
        hardware: d.hardware,
        memoryTotal: d.memoryTotal,
        memoryAvailable: d.memoryAvailable,
        observedAt: d.observedAt,
        group: d.group,
        note: d.note,
      }))}
      connectors={overview?.connectors || []}
      deployments={(overview?.deployments || []).map((d) => ({
        id: d._id,
        model: d.model,
        status: d.status,
        connectorId: d.connectorId,
        artifactRepo: d.artifactRepo,
        observedAt: d.observedAt,
      }))}
      onSelect={(id) =>
        router.push(`/workspace?conversation=${encodeURIComponent(id)}`)
      }
      onNew={() => router.push("/workspace")}
      onSend={async (text, mode, deploymentId, maxTokens) => {
        const conversationId =
          id ||
          (await create({
            mode,
            deploymentId: deploymentId as Id<"deployments">,
          }));
        if (!id)
          router.replace(
            `/workspace?conversation=${encodeURIComponent(conversationId)}`,
          );
        await send({
          conversationId,
          text,
          maxTokens,
          key: crypto.randomUUID(),
        });
      }}
      onCancel={async (id) => {
        await cancel({ id: id as Id<"workspaceJobs"> });
      }}
      onRevoke={async (id) => {
        await revoke({ id: id as Id<"connectors"> });
      }}
      connectionPanel={panel}
    />
  );
}
