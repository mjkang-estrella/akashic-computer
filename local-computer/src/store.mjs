import {
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export class Store {
  constructor(dir) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.path = join(dir, "state.json");
    this.data = existsSync(this.path)
      ? JSON.parse(readFileSync(this.path, "utf8"))
      : { sessions: [], jobs: [] };
    // Never replay an ambiguous operation after a controller restart.
    for (const job of this.data.jobs)
      if (["queued", "running"].includes(job.status)) {
        job.status = "interrupted";
        job.error =
          "Controller restarted. Partial output is retained. Send a new message to retry.";
        job.finishedAt = new Date().toISOString();
      }
    this.save();
  }
  save() {
    const tmp = this.path + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    renameSync(tmp, this.path);
  }
  createSession(title = "New session", mode = "chat") {
    if (!["chat", "agent"].includes(mode))
      throw new Error("Unknown session mode");
    const session = {
      id: randomUUID(),
      title: String(title).slice(0, 100),
      mode,
      createdAt: new Date().toISOString(),
      messages: [],
    };
    this.data.sessions.unshift(session);
    this.save();
    return session;
  }
  session(id) {
    const s = this.data.sessions.find((s) => s.id === id);
    if (!s) throw new Error("Session not found");
    return s;
  }
  job(id) {
    const j = this.data.jobs.find((j) => j.id === id);
    if (!j) throw new Error("Job not found");
    return j;
  }
  enqueue(sessionId, text, key, maxTokens = 2048, metadata = {}) {
    const s = this.session(sessionId);
    if (typeof text !== "string" || !text.trim() || text.length > 16000)
      throw new Error("Message must contain 1–16000 characters");
    if (typeof key !== "string" || key.length < 8 || key.length > 100)
      throw new Error("An idempotency key is required");
    const old = this.data.jobs.find(
      (j) => j.sessionId === sessionId && j.key === key,
    );
    if (old) {
      if (old.prompt !== text || old.maxTokens !== maxTokens)
        throw new Error("Idempotency key already used for a different request");
      return old;
    }
    if (
      this.data.jobs.some(
        (j) =>
          j.sessionId === sessionId && ["queued", "running"].includes(j.status),
      )
    )
      throw new Error("This session already has an active job");
    const job = {
      ...metadata,
      id: randomUUID(),
      sessionId,
      key,
      prompt: text,
      maxTokens,
      status: "queued",
      output: "",
      events: [],
      createdAt: new Date().toISOString(),
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      rounds: 0,
    };
    s.messages.push({ role: "user", content: text, jobId: job.id });
    if (s.title === "New session") s.title = text.slice(0, 58);
    this.data.jobs.push(job);
    this.save();
    return job;
  }
}
