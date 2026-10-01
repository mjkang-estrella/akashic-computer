import { useEffect, useRef, useState } from "react";
import type { WorkspaceProps, Deployment } from "./types";
import { ChatIcon } from "./ChatIcon";
import { CopyButton, MessageBody } from "./MessageBody";

export function SessionChat({
  p,
  available,
  now,
  onToggleSidebar,
  sidebarExpanded,
}: {
  p: WorkspaceProps;
  available: Deployment[];
  now: number;
  onToggleSidebar: () => void;
  sidebarExpanded: boolean;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"chat" | "agent">("chat");
  const [deployment, setDeployment] = useState("");
  const [budget, setBudget] = useState(4096);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showJump, setShowJump] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const followOutput = useRef(true);
  const form = useRef<HTMLFormElement>(null);
  const selected =
    p.current?.deploymentId ||
    deployment ||
    (available.some((d) => d.id === p.preferredDeploymentId)
      ? p.preferredDeploymentId
      : undefined) ||
    available[0]?.id ||
    "";
  const job = p.jobs.find((j) =>
    ["queued", "running", "cancelling"].includes(j.status),
  );
  const empty = !p.messages.length && !job;
  useEffect(() => {
    followOutput.current = true;
  }, [p.current?.id]);
  useEffect(() => {
    const el = transcript.current;
    if (el && followOutput.current) el.scrollTop = el.scrollHeight;
  }, [p.current?.id, p.messages.length, job?.output]);
  useEffect(() => {
    const el = input.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }, [text]);
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
    <>
      <header className="ac-chat-toolbar">
        <button
          className="ac-icon-button ac-sidebar-toggle"
          aria-label="Toggle conversations"
          aria-controls="ac-conversations"
          aria-expanded={sidebarExpanded}
          onClick={onToggleSidebar}
        >
          <ChatIcon name="sidebar" />
        </button>
        <div className="ac-model-picker">
          <label className="ac-sr-only" htmlFor="ac-model">
            Running model
          </label>
          <select
            id="ac-model"
            value={selected}
            disabled={!!p.current}
            onChange={(e) => setDeployment(e.target.value)}
          >
            {!available.length && <option value="">Connect a model</option>}
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {d.model}
              </option>
            ))}
          </select>
          {!p.current && <ChatIcon name="down" />}
        </div>
        <span className="ac-storage-badge">
          {p.legacy ? "Device only" : "Account"}
        </span>
      </header>
      {(error || p.notice) && (
        <p role="alert" className="ac-notice ac-chat-notice">
          {error || p.notice}
        </p>
      )}
      <div className="ac-chat-scroll-wrap">
        <div
          className={`ac-transcript ${empty ? "is-empty" : ""}`}
          ref={transcript}
          aria-label="Conversation transcript"
          onScroll={(e) => {
            const el = e.currentTarget;
            const away = el.scrollHeight - el.scrollTop - el.clientHeight >= 80;
            followOutput.current = !away;
            setShowJump(away);
          }}
        >
          <div className="ac-conversation-column">
            {empty && (
              <div className="ac-chat-welcome">
                <h1>
                  {p.loading
                    ? "Opening your workspace…"
                    : "What would you like to work on?"}
                </h1>
                <p>
                  {available.length
                    ? "Your models, running on your computers."
                    : "Connect a running model from Computers to start chatting."}
                </p>
              </div>
            )}
            {p.messages.map((m) => (
              <article
                className={`ac-message ${m.role}`}
                key={m.id}
                aria-label={
                  m.role === "user" ? "Your message" : "Model response"
                }
              >
                <span className="ac-sr-only">
                  {m.role === "user" ? "You" : "Local model"}
                </span>
                {m.role === "user" ? (
                  <div className="ac-user-bubble">{m.content}</div>
                ) : (
                  <>
                    <MessageBody content={m.content} />
                    <div className="ac-message-actions">
                      <CopyButton text={m.content} />
                      {p.onShare && (
                        <button
                          className="ac-text-action"
                          onClick={() =>
                            void perform(() => p.onShare!(m.content))
                          }
                        >
                          Send to ChatGPT
                        </button>
                      )}
                      {m.partial && (
                        <span className="ac-muted">Partial response</span>
                      )}
                    </div>
                  </>
                )}
              </article>
            ))}
            {job && (
              <article className="ac-message assistant ac-live-response">
                <p role="status" className="ac-generation-status">
                  <span className="ac-thinking-dot" />
                  {job.leaseUntil && job.leaseUntil < now
                    ? "Connection interrupted"
                    : job.status === "queued"
                      ? "Waiting for your computer"
                      : job.status === "cancelling"
                        ? "Stopping…"
                        : "Working locally"}
                </p>
                {job.output && <MessageBody content={job.output} />}{" "}
                {!!job.events?.length && (
                  <details className="ac-run-details">
                    <summary>Tool activity</summary>
                    {job.events.map((e, i) => (
                      <div key={i}>
                        {e.tool} · {e.status}
                      </div>
                    ))}
                  </details>
                )}
              </article>
            )}
            {!job &&
              p.jobs.slice(0, 1).map((j) => (
                <div className="ac-completion" key={j.id}>
                  {j.error && (
                    <p role="alert" className="ac-notice">
                      {j.error}
                    </p>
                  )}
                  <details className="ac-run-details">
                    <summary>Run details</summary>
                    <p>
                      {j.status} · {j.rounds} local{" "}
                      {j.rounds === 1 ? "round" : "rounds"} ·{" "}
                      {j.completionTokens} output tokens
                    </p>
                  </details>
                </div>
              ))}
          </div>
        </div>
        {showJump && (
          <button
            className="ac-jump ac-icon-button"
            aria-label="Jump to latest message"
            onClick={() => {
              followOutput.current = true;
              const el = transcript.current;
              if (el) el.scrollTop = el.scrollHeight;
              setShowJump(false);
            }}
          >
            <ChatIcon name="down" />
          </button>
        )}
      </div>
      <div className="ac-composer-dock">
        <form
          ref={form}
          className="ac-composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || busy || job || !selected) return;
            followOutput.current = true;
            void perform(async () => {
              await p.onSend(text, p.current?.mode || mode, selected, budget);
              setText("");
              input.current?.focus();
            });
          }}
        >
          <label className="ac-sr-only" htmlFor="ac-message-input">
            Message your local model
          </label>
          <textarea
            id="ac-message-input"
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                form.current?.requestSubmit();
              }
            }}
            maxLength={16000}
            placeholder="Message your local model"
            rows={1}
          />
          <div className="ac-composer-bottom">
            <div className="ac-mode-select">
              <label className="ac-sr-only" htmlFor="ac-mode">
                Mode
              </label>
              <select
                id="ac-mode"
                value={p.current?.mode || mode}
                disabled={!!p.current}
                onChange={(e) => setMode(e.target.value as "chat" | "agent")}
              >
                <option value="chat">Direct chat</option>
                <option value="agent">Fleet agent</option>
              </select>
            </div>
            <details className="ac-composer-options">
              <summary
                aria-label="Generation settings"
                title="Generation settings"
              >
                <ChatIcon name="settings" />
              </summary>
              <div className="ac-options-popover">
                <label htmlFor="ac-budget">Output limit</label>
                <select
                  id="ac-budget"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                >
                  <option value={2048}>2k tokens</option>
                  <option value={4096}>4k tokens</option>
                  <option value={8192}>8k tokens</option>
                </select>
                <p>Fleet agent uses read-only tools.</p>
              </div>
            </details>
            {job ? (
              <button
                type="button"
                className="ac-send"
                aria-label="Stop generation"
                title="Stop generation"
                disabled={job.status === "cancelling" || busy}
                onClick={() => void perform(() => p.onCancel(job.id))}
              >
                <ChatIcon name="stop" />
              </button>
            ) : (
              <button
                type="submit"
                className="ac-send"
                aria-label="Send message"
                title="Send message"
                disabled={busy || !selected || !text.trim()}
              >
                <ChatIcon name="send" />
              </button>
            )}
          </div>
        </form>
        <p className="ac-composer-caption">
          Local inference ·{" "}
          {p.legacy
            ? "History on this device"
            : "History synced to your account"}
        </p>
      </div>
    </>
  );
}
