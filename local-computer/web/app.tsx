import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@modelcontextprotocol/ext-apps";
import { Workspace } from "../../src/components/workspace/Workspace";
import type {
  WorkspaceProps,
  Conversation,
  Computer,
  Connector,
  Deployment,
  Message,
  Job,
} from "../../src/components/workspace/types";

const embedded = window.parent !== window;
let bridge: App | undefined;
async function call<T>(name: string, args: object = {}): Promise<T> {
  if (bridge) {
    const r = await bridge.callServerTool({ name, arguments: { ...args } });
    if (r.isError)
      throw new Error(String((r.content?.[0] as { text?: string })?.text));
    return (r._meta as { data: T }).data;
  }
  const r = await fetch("/api/" + name, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (r.status === 401) throw new Error("SIGN_IN");
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
type RawSession = {
  _id: string;
  title: string;
  mode: "chat" | "agent";
  deploymentId: string;
};
type RawData = {
  conversation: RawSession;
  messages: ({ _id: string } & Omit<Message, "id">)[];
  jobs: {
    _id: string;
    status: string;
    error?: string;
    rounds: number;
    completionTokens: number;
    leaseUntil?: number;
  }[];
  progress: {
    jobId: string;
    content: string;
    events: { tool: string; status: string }[];
  }[];
};
type RawOverview = {
  connectors: Connector[];
  devices: ({ _id: string } & Omit<Computer, "id">)[];
  deployments: ({ _id: string } & Omit<Deployment, "id">)[];
};
type LocalData = {
  id: string;
  title: string;
  mode: "chat" | "agent";
  messages: { role: string; content: string; partial?: boolean }[];
  jobs: {
    id: string;
    status: string;
    output: string;
    error?: string;
    rounds: number;
    events: Job["events"];
    usage: { completion_tokens: number };
  }[];
};
type LocalOverview = {
  hosts: {
    id: string;
    role: string;
    state?: string;
    status: string;
    observedAt?: string;
    hardware?: string;
    error?: string;
    failedUnits?: string;
    allocation_group?: string;
    memory?: { MemTotal: number; MemAvailable: number };
  }[];
  model: { models: { id: string }[]; status: string };
};
const initial = {
  sessions: [] as Conversation[],
  current: null as Conversation | null,
  messages: [] as Message[],
  jobs: [] as Job[],
  devices: [] as Computer[],
  connectors: [] as Connector[],
  deployments: [] as Deployment[],
};
function LocalApp() {
  const [view, setView] = useState<"work" | "computers">("work");
  const [account, setAccount] = useState(false);
  const [connected, setConnected] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState(false);
  const [token, setToken] = useState("");
  const refresh = useCallback(async () => {
    try {
      const connection = await call<{ connected: boolean }>("get_connection");
      setConnected(connection.connected);
      if (account && connection.connected) {
        const [o, s, c] = await Promise.all([
          call<RawOverview>("account_overview"),
          call<RawSession[]>("account_sessions"),
          id ? call<RawData>("account_session", { id }) : null,
        ]);
        setData({
          sessions: s.map((s) => ({
            id: s._id,
            title: s.title,
            mode: s.mode,
            deploymentId: s.deploymentId,
          })),
          current: c
            ? {
                id: c.conversation._id,
                title: c.conversation.title,
                mode: c.conversation.mode,
                deploymentId: c.conversation.deploymentId,
              }
            : null,
          messages: c?.messages.map((m) => ({ ...m, id: m._id })) || [],
          jobs:
            c?.jobs.map((j) => ({
              ...j,
              id: j._id,
              output: c.progress.find((p) => p.jobId === j._id)?.content,
              events: c.progress.find((p) => p.jobId === j._id)?.events,
            })) || [],
          devices: o.devices.map((d) => ({ ...d, id: d._id })),
          connectors: o.connectors,
          deployments: o.deployments.map((d) => ({ ...d, id: d._id })),
        });
      } else {
        const [o, s, c] = await Promise.all([
          call<LocalOverview>("get_overview"),
          call<Conversation[]>("list_sessions"),
          id ? call<LocalData>("get_session", { session_id: id }) : null,
        ]);
        setData({
          sessions: s,
          current: c
            ? {
                id: c.id,
                title: c.title,
                mode: c.mode,
                deploymentId: o.model.models[0]?.id,
              }
            : null,
          messages: c?.messages.map((m, i) => ({ ...m, id: String(i) })) || [],
          jobs:
            c?.jobs
              .slice()
              .reverse()
              .map((j) => ({
                ...j,
                completionTokens: j.usage.completion_tokens,
              })) || [],
          devices: o.hosts.map((h) => ({
            id: h.id,
            name: h.id === "local-mac" ? "This Mac" : h.id,
            role: h.role,
            state: h.state || "observed",
            status: h.status,
            observedAt: h.observedAt ? Date.parse(h.observedAt) : undefined,
            hardware: h.hardware,
            memoryTotal: h.memory?.MemTotal,
            memoryAvailable: h.memory?.MemAvailable,
            group: h.allocation_group,
            note:
              h.error ||
              (h.failedUnits && h.failedUnits !== "unavailable"
                ? h.failedUnits
                : undefined),
          })),
          connectors: [],
          deployments: o.model.models.map((m) => ({
            id: m.id,
            model: m.id,
            status: o.model.status,
            connectorId: "local",
          })),
        });
      }
      setError("");
      setLogin(false);
    } catch (e) {
      if (e instanceof Error && e.message === "SIGN_IN") setLogin(true);
      else setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }, [account, id]);
  useEffect(() => {
    let pending = false;
    const run = async () => {
      if (pending) return;
      pending = true;
      await refresh();
      pending = false;
    };
    void run();
    const timer = setInterval(() => void run(), 2000);
    return () => clearInterval(timer);
  }, [refresh]);
  if (login)
    return (
      <main className="local-login">
        <h1>Akashic Computer</h1>
        <p>
          Connect to the controller using the token in{" "}
          <code>~/.local/share/akashic-local/token</code>.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            if (r.ok) {
              setToken("");
              await refresh();
            } else setError("Token did not match.");
          }}
        >
          <input
            type="password"
            aria-label="Local access token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button>Connect</button>
        </form>
        {error && <p role="alert">{error}</p>}
      </main>
    );
  const send: WorkspaceProps["onSend"] = async (
    text,
    mode,
    deploymentId,
    maxTokens,
  ) => {
    if (account) {
      const conversationId =
        id || (await call<string>("account_create", { mode, deploymentId }));
      setId(conversationId);
      await call("account_send", {
        conversationId,
        text,
        key: crypto.randomUUID(),
        maxTokens,
      });
    } else {
      const session =
        id || (await call<{ id: string }>("create_session", { mode })).id;
      setId(session);
      await call("send_message", {
        session_id: session,
        text,
        idempotency_key: crypto.randomUUID(),
        max_tokens: maxTokens,
      });
    }
    await refresh();
  };
  return (
    <>
      <header className="local-header">
        <a
          href="https://akashic.computer"
          target="_blank"
          rel="noreferrer"
          className="local-brand"
        >
          Akashic Computer
        </a>
        <a
          href="https://akashic.computer/models"
          target="_blank"
          rel="noreferrer"
        >
          Models
        </a>
        <a
          href="https://akashic.computer/benchmarks"
          target="_blank"
          rel="noreferrer"
        >
          Benchmarks
        </a>
        <a
          href="https://akashic.computer/docs"
          target="_blank"
          rel="noreferrer"
        >
          Docs
        </a>
        <button onClick={() => setView("work")}>Workspace</button>
        <button onClick={() => setView("computers")}>Computers</button>
        <label>
          Storage
          <select
            aria-label="Conversation storage"
            value={account ? "account" : "local"}
            onChange={(e) => {
              setId(null);
              setData(initial);
              setAccount(e.target.value === "account");
            }}
          >
            <option value="local">Device only</option>
            <option value="account" disabled={!connected}>
              Account · this controller
            </option>
          </select>
        </label>
      </header>
      <Workspace
        {...data}
        view={view}
        legacy={!account}
        loading={loading}
        notice={error}
        onNew={() => {
          setId(null);
          setView("work");
        }}
        onSelect={(s) => {
          setId(s);
          setView("work");
        }}
        onSend={send}
        onCancel={async (jobId) => {
          await call(
            account ? "account_cancel" : "cancel_job",
            account ? { jobId } : { job_id: jobId },
          );
          await refresh();
        }}
        onRefresh={refresh}
        onShare={
          embedded
            ? async (text) => {
                await bridge!.sendMessage({
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Selected result from Akashic Computer:\n${text.slice(0, 24000)}`,
                    },
                  ],
                });
              }
            : undefined
        }
        connectionPanel={
          !connected ? (
            <div className="ac-connect">
              <a
                href="https://akashic.computer/computers"
                target="_blank"
                rel="noreferrer"
              >
                Sign in and connect this controller
              </a>
              <p>
                Device-only conversations remain local until you choose an
                account session.
              </p>
            </div>
          ) : undefined
        }
      />
    </>
  );
}
async function boot() {
  if (embedded) {
    bridge = new App(
      { name: "Akashic Computer", version: "0.2.2" },
      {},
      { autoResize: true },
    );
    await bridge.connect();
  }
  createRoot(document.getElementById("app")!).render(<LocalApp />);
}
void boot().catch((e) => {
  document.getElementById("app")!.textContent =
    `Unable to open Akashic Computer: ${e.message}`;
});
