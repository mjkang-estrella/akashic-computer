"use client";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceProps } from "./types";
import { ChatIcon } from "./ChatIcon";
import { SessionChat } from "./SessionChat";
const memory = (bytes?: number) =>
  bytes === undefined ? "—" : `${(bytes / 1073741824).toFixed(1)} GiB`;
export function Workspace(p: WorkspaceProps) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    sidebar.current
      ?.querySelector<HTMLButtonElement>(".ac-sidebar-close")
      ?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMobileOpen(false);
      requestAnimationFrame(() =>
        root.current
          ?.querySelector<HTMLButtonElement>(".ac-sidebar-toggle")
          ?.focus(),
      );
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [mobileOpen]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const resize = () => {
      setIsMobile(media.matches);
      const el = root.current;
      if (el)
        el.style.setProperty(
          "--ac-viewport-height",
          `${Math.max(260, (window.visualViewport?.height || window.innerHeight) - el.getBoundingClientRect().top)}px`,
        );
    };
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    const header = document.querySelector("header");
    const observer = new ResizeObserver(resize);
    if (header) observer.observe(header);
    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);
  const connected = (id: string) => {
    const c = p.connectors.find((c) => c.id === id);
    return !c || (!c.revoked && now - c.lastSeenAt < 60000);
  };
  const available = p.deployments.filter(
    (d) => d.status === "online" && connected(d.connectorId),
  );
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
  function closeMobile() {
    setMobileOpen(false);
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLButtonElement>(".ac-sidebar-toggle")
        ?.focus(),
    );
  }
  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen((v) => !v);
    } else setCollapsed((v) => !v);
  }
  function select(id: string) {
    p.onSelect(id);
    if (isMobile) closeMobile();
  }
  function newSession() {
    setSearch("");
    p.onNew();
    if (isMobile) closeMobile();
  }
  return (
    <div
      ref={root}
      className="ac-workspace"
      data-view={p.view}
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
      onKeyDown={(e) => {
        if (!mobileOpen) return;
        if (e.key === "Tab") {
          const items = sidebar.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input,summary,a[href]",
          );
          if (!items?.length) return;
          const first = items[0],
            last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      {mobileOpen && (
        <button
          className="ac-sidebar-scrim"
          tabIndex={-1}
          aria-label="Close conversations"
          onClick={closeMobile}
        />
      )}
      <aside
        ref={sidebar}
        id="ac-conversations"
        className="ac-sessions"
        aria-label="Conversations"
        role={isMobile ? "dialog" : undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined}
      >
        <div className="ac-sidebar-header">
          <button
            className="ac-new-chat"
            onClick={newSession}
            title="New chat"
            aria-label="New session"
          >
            <ChatIcon name="new" />
            <span className="ac-new-label">New chat</span>
          </button>
          <button
            className="ac-icon-button ac-sidebar-close"
            aria-label={isMobile ? "Close conversations" : "Collapse sidebar"}
            onClick={isMobile ? closeMobile : () => setCollapsed((v) => !v)}
          >
            <ChatIcon name={isMobile ? "close" : "sidebar"} />
          </button>
        </div>
        <div className="ac-sidebar-body">
          <label className="ac-chat-search">
            <ChatIcon name="search" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              aria-label="Search conversations"
            />
          </label>
          <p className="ac-label ac-history-label">Your chats</p>
          <div className="ac-session-list">
            {p.sessions
              .filter((s) =>
                s.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((s) => (
                <button
                  key={s.id}
                  className={`ac-session ${p.current?.id === s.id ? "selected" : ""}`}
                  aria-current={p.current?.id === s.id ? "page" : undefined}
                  title={s.title}
                  onClick={() => select(s.id)}
                >
                  {s.title}
                </button>
              ))}
            {!p.sessions.length && !p.loading && (
              <p className="ac-muted ac-sidebar-empty">
                Your conversations will appear here.
              </p>
            )}
            {search &&
              !p.sessions.some((s) =>
                s.title.toLowerCase().includes(search.toLowerCase()),
              ) && (
                <p className="ac-muted ac-sidebar-empty">
                  No matching conversations.
                </p>
              )}
          </div>
        </div>
        <details className="ac-sidebar-privacy">
          <summary>
            <ChatIcon name="info" />
            {p.legacy ? "Device-only history" : "Account history"}
          </summary>
          <p>
            {p.legacy
              ? "Stored on this computer. Not uploaded to your account."
              : "Prompts and results sync through Convex. Your connected computer runs the model."}
          </p>
        </details>
      </aside>
      <section
        className="ac-main"
        inert={isMobile && mobileOpen ? true : undefined}
      >
        {p.view === "computers" ? (
          <>
            <div className="ac-computer-toolbar">
              <button
                className="ac-icon-button ac-sidebar-toggle"
                aria-label="Toggle conversations"
                aria-controls="ac-conversations"
                aria-expanded={isMobile ? mobileOpen : !collapsed}
                onClick={toggleSidebar}
              >
                <ChatIcon name="sidebar" />
              </button>
            </div>
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
            <>
              <div className="ac-heading">
                <h1>Your computers</h1>
                {p.onRefresh && (
                  <button
                    className="ac-secondary"
                    disabled={busy}
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
          </>
        ) : (
          <SessionChat
            p={p}
            available={available}
            now={now}
            onToggleSidebar={toggleSidebar}
            sidebarExpanded={isMobile ? mobileOpen : !collapsed}
          />
        )}
      </section>
    </div>
  );
}
