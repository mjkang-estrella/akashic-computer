"use client";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceProps } from "./types";

const active = (status: string) =>
  ["queued", "running", "cancelling"].includes(status);
const memory = (bytes?: number) =>
  bytes === undefined ? "—" : `${(bytes / 1073741824).toFixed(1)} GiB`;
export function Workspace(p: WorkspaceProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"chat" | "agent">("chat");
  const [deployment, setDeployment] = useState("");
  const [budget, setBudget] = useState(4096);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const transcript = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const connected = (id: string) => {
    const c = p.connectors.find((c) => c.id === id);
    return !c || (!c.revoked && now - c.lastSeenAt < 60000);
  };
  const available = p.deployments.filter(
    (d) => d.status === "online" && connected(d.connectorId),
  );
  const selected =
    p.current?.deploymentId ||
    deployment ||
    (available.some((d) => d.id === p.preferredDeploymentId)
      ? p.preferredDeploymentId
      : undefined) ||
    available[0]?.id ||
    "";
  const job = p.jobs.find((j) => active(j.status));
  useEffect(() => {
    followOutput.current = true;
  }, [p.current?.id]);
  useEffect(() => {
    const el = transcript.current;
    if (el && followOutput.current) el.scrollTop = el.scrollHeight;
  }, [p.current?.id, p.messages.length, job?.output]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ac-workspace">
      <aside className="ac-sessions" aria-label="Conversations">
        <button className="ac-primary" onClick={p.onNew}>
          New session
        </button>
        <p className="ac-label">
          {p.legacy ? "Device-only sessions" : "Account conversations"}
        </p>
        {p.sessions.map((s) => (
          <button
            key={s.id}
            className={`ac-session ${p.current?.id === s.id ? "selected" : ""}`}
            aria-pressed={p.current?.id === s.id}
            onClick={() => p.onSelect(s.id)}
          >
            {s.title}
          </button>
        ))}
        {!p.sessions.length && !p.loading && (
          <p className="ac-muted">Your conversations will appear here.</p>
        )}
        <p className="ac-boundary">
          {p.legacy
            ? "Stored on this computer. Not uploaded to your account."
            : "Prompts and results sync through Convex. Your connected computer runs the model."}
        </p>
      </aside>
      <section className="ac-main">
        {(error || p.notice) && (
          <p role="alert" className="ac-notice">
            {error || p.notice}
          </p>
        )}
        {p.loading && (
          <p role="status" className="ac-muted">
            Loading your workspace…
          </p>
        )}
        {p.view === "computers" ? (
          <>
            <div className="ac-heading">
              <h1>Your computers</h1>
              {p.onRefresh && (
                <button
                  className="ac-secondary"
                  onClick={() => void perform(p.onRefresh!)}
                >
                  Refresh
                </button>
              )}
            </div>
            <p className="ac-muted">
              Observed health, running models, and enrolled controllers.
              Inference stays on your fleet.
            </p>
            {p.connectionPanel}
            {p.connectors.map((c) => (
              <div className="ac-connector" key={c.id}>
                <div>
                  <strong>{c.name}</strong>
                  <p className="ac-muted">
                    {c.revoked
                      ? "Revoked"
                      : connected(c.id)
                        ? "Connected"
                        : "Controller offline"}{" "}
                    ·{" "}
                    {c.lastSeenAt
                      ? new Date(c.lastSeenAt).toLocaleString()
                      : "Waiting for first heartbeat"}
                  </p>
                </div>
                {p.onRevoke && !c.revoked && (
                  <button
                    className="ac-secondary"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Disconnect ${c.name}? Active cloud work will be interrupted.`,
                        )
                      )
                        void perform(() => p.onRevoke!(c.id));
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ))}
            <div className="ac-devices">
              {p.devices.map((d) => (
                <article className="ac-device" key={d.id}>
                  <div className="ac-heading">
                    <h2>{d.name}</h2>
                    <span className="ac-status">
                      {d.state === "retired" || d.state === "planned"
                        ? d.state
                        : d.connectorId && !connected(d.connectorId)
                          ? "controller offline"
                          : d.status}
                    </span>
                  </div>
                  <p className="ac-muted">{d.group || d.role}</p>
                  <p>{d.hardware || "Hardware not reported"}</p>
                  {d.memoryTotal !== undefined && (
                    <>
                      <progress
                        max={100}
                        value={
                          100 * (1 - (d.memoryAvailable || 0) / d.memoryTotal)
                        }
                        aria-label="Used system memory"
                      />
                      <p className="ac-data">
                        {memory(d.memoryAvailable)}{" "}
                        {d.role === "controller" ? "free" : "available"} /{" "}
                        {memory(d.memoryTotal)}
                      </p>
                    </>
                  )}
                  {d.note && <p className="ac-notice">{d.note}</p>}
                  <p className="ac-muted">
                    {d.observedAt
                      ? `Observed ${new Date(d.observedAt).toLocaleString()}`
                      : "Inventory only; not directly observed"}
                  </p>
                </article>
              ))}
            </div>
            {!p.devices.length && !p.loading && (
              <p className="ac-empty">
                Connect your Mac controller to bring its fleet into this
                account.
              </p>
            )}
            <h2>Model deployments</h2>
            {p.deployments.map((d) => (
              <div className="ac-deployment" key={d.id}>
                <strong>{d.model}</strong>
                <span>
                  {connected(d.connectorId) ? d.status : "controller offline"}
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="ac-heading">
              <h1>{p.current?.title || "Start a local-model conversation"}</h1>
              {p.legacy && <span className="ac-status">Device only</span>}
            </div>
            <div
              className="ac-transcript"
              ref={transcript}
              onScroll={(e) => {
                const el = e.currentTarget;
                followOutput.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              aria-label="Conversation transcript"
            >
              {!p.messages.length && !p.loading && (
                <div className="ac-empty">
                  <p>
                    Choose a running model and send a message. Fleet agent mode
                    can inspect your enrolled computers using read-only tools.
                  </p>
                  {!available.length && (
                    <p>
                      No running deployment is connected. Open Computers to
                      connect your controller.
                    </p>
                  )}
                </div>
              )}
              {p.messages.map((m) => (
                <article className={`ac-message ${m.role}`} key={m.id}>
                  <p className="ac-label">
                    {m.role === "user" ? "You" : "Local model"}
                    {m.partial ? " · partial" : ""}
                  </p>
                  <div className="ac-message-text">{m.content}</div>
                </article>
              ))}
              {job && (
                <article className="ac-message">
                  <p role="status" className="ac-label">
                    {job.leaseUntil && job.leaseUntil < now
                      ? "Connection interrupted; awaiting reconciliation"
                      : job.status}
                  </p>
                  <div className="ac-message-text">
                    {job.output || "Waiting for the connected computer…"}
                  </div>
                  <p className="ac-data">
                    {job.events
                      ?.map((e) => `${e.tool}: ${e.status}`)
                      .join(" · ")}
                  </p>
                  <button
                    className="ac-secondary"
                    disabled={job.status === "cancelling" || busy}
                    onClick={() => void perform(() => p.onCancel(job.id))}
                  >
                    {job.status === "cancelling" ? "Cancelling…" : "Stop job"}
                  </button>
                </article>
              )}
              {!job &&
                p.jobs.slice(0, 1).map((j) => (
                  <div className="ac-receipt" key={j.id}>
                    <p>
                      {j.status} · {j.rounds} local rounds ·{" "}
                      {j.completionTokens} output tokens
                    </p>
                    {j.error && <p role="alert">{j.error}</p>}
                    {p.onShare &&
                      p.messages.some((m) => m.role === "assistant") && (
                        <button
                          className="ac-secondary"
                          onClick={() =>
                            void perform(() =>
                              p.onShare!(
                                p.messages
                                  .filter((m) => m.role === "assistant")
                                  .at(-1)!.content,
                              ),
                            )
                          }
                        >
                          Send result to ChatGPT
                        </button>
                      )}
                  </div>
                ))}
            </div>
            <form
              className="ac-composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim() || busy || job) return;
                followOutput.current = true;
                void perform(async () => {
                  await p.onSend(
                    text,
                    p.current?.mode || mode,
                    selected,
                    budget,
                  );
                  setText("");
                });
              }}
            >
              <div className="ac-controls">
                <label>
                  Mode
                  <select
                    value={p.current?.mode || mode}
                    disabled={!!p.current}
                    onChange={(e) =>
                      setMode(e.target.value as "chat" | "agent")
                    }
                  >
                    <option value="chat">Direct chat</option>
                    <option value="agent">Fleet agent · read only</option>
                  </select>
                </label>
                <label>
                  Running model
                  <select
                    value={selected}
                    disabled={!!p.current}
                    onChange={(e) => setDeployment(e.target.value)}
                  >
                    {!available.length && (
                      <option value="">No connected model</option>
                    )}
                    {available.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.model}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Output limit
                  <select
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                  >
                    <option value={2048}>2k tokens</option>
                    <option value={4096}>4k tokens</option>
                    <option value={8192}>8k tokens</option>
                  </select>
                </label>
              </div>
              <label className="ac-prompt-label">
                Message
                <textarea
                  aria-label="Message your local model"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={16000}
                  placeholder="What would you like to work on?"
                  rows={3}
                />
              </label>
              <div className="ac-heading">
                <span className="ac-muted">
                  {p.legacy
                    ? "Last 12 messages form the context."
                    : "Synced through your account. No cloud model fallback."}
                </span>
                <button
                  className="ac-primary"
                  disabled={busy || !!job || !selected || !text.trim()}
                >
                  {busy ? "Sending…" : "Send message"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
