import { z } from "zod";
import { cloudCall, cloudConfig } from "./cloud.mjs";
export const schemas = {
  get_connection: z.object({}),
  account_overview: z.object({}),
  account_sessions: z.object({}),
  account_session: z.object({ id: z.string() }),
  account_create: z.object({
    deploymentId: z.string(),
    mode: z.enum(["chat", "agent"]),
  }),
  account_send: z.object({
    conversationId: z.string(),
    text: z.string().min(1).max(16000),
    key: z.string().min(8).max(100),
    maxTokens: z.number().int().min(128).max(8192),
  }),
  account_cancel: z.object({ jobId: z.string() }),
  get_overview: z.object({ fresh: z.boolean().optional() }),
  list_sessions: z.object({}),
  create_session: z.object({
    title: z.string().max(100).optional(),
    mode: z.enum(["chat", "agent"]).default("chat"),
  }),
  get_session: z.object({ session_id: z.string().uuid() }),
  send_message: z.object({
    session_id: z.string().uuid(),
    text: z.string().min(1).max(16000),
    idempotency_key: z.string().min(8).max(100),
    max_tokens: z.number().int().min(128).max(8192).default(2048),
  }),
  get_job: z.object({ job_id: z.string().uuid() }),
  cancel_job: z.object({ job_id: z.string().uuid() }),
  delegate_task: z.object({
    brief: z.string().min(1).max(16000),
    idempotency_key: z.string().min(8).max(100),
    max_tokens: z.number().int().min(128).max(8192).default(4096),
  }),
};
export class Service {
  constructor(store, fleet, runner) {
    this.store = store;
    this.fleet = fleet;
    this.runner = runner;
  }
  async call(name, raw) {
    if (!schemas[name]) throw new Error("Unknown operation");
    const a = schemas[name].strict().parse(raw);
    switch (name) {
      case "get_connection":
        return {
          connected: !!cloudConfig(),
          site: cloudConfig()?.site || null,
        };
      case "account_overview":
        return cloudCall("client-read", { operation: "overview" });
      case "account_sessions":
        return cloudCall("client-read", { operation: "sessions" });
      case "account_session":
        return cloudCall("client-read", {
          operation: "session",
          conversationId: a.id,
        });
      case "account_create":
        return cloudCall("client-write", { operation: "create", ...a });
      case "account_send":
        return cloudCall("client-write", { operation: "send", ...a });
      case "account_cancel":
        return cloudCall("client-write", { operation: "cancel", ...a });
      case "get_overview": {
        const [fleet, model] = await Promise.all([
          this.fleet.snapshot(a.fresh),
          this.fleet.models(),
        ]);
        return {
          ...fleet,
          model,
          activeJobs: this.store.data.jobs.filter((j) =>
            ["queued", "running"].includes(j.status),
          ).length,
        };
      }
      case "list_sessions":
        return this.store.data.sessions
          .filter((s) => !s.cloudConversationId)
          .map(({ messages, ...s }) => ({
            ...s,
            messageCount: messages.length,
          }));
      case "create_session":
        return this.store.createSession(a.title, a.mode);
      case "get_session":
        return {
          ...this.store.session(a.session_id),
          jobs: this.store.data.jobs.filter(
            (j) => j.sessionId === a.session_id,
          ),
        };
      case "send_message": {
        const job = this.store.enqueue(
          a.session_id,
          a.text,
          a.idempotency_key,
          a.max_tokens,
        );
        this.runner.wake();
        return { jobId: job.id, status: job.status };
      }
      case "get_job":
        return this.store.job(a.job_id);
      case "cancel_job":
        return this.runner.cancel(a.job_id);
      case "delegate_task": {
        const old = this.store.data.jobs.find(
          (j) => j.delegationKey === a.idempotency_key,
        );
        if (old) {
          if (old.prompt !== a.brief || old.maxTokens !== a.max_tokens)
            throw new Error("Idempotency key conflict");
          return {
            jobId: old.id,
            sessionId: old.sessionId,
            status: old.status,
          };
        }
        const session = this.store.createSession(a.brief.slice(0, 58), "agent");
        const job = this.store.enqueue(
          session.id,
          a.brief,
          a.idempotency_key,
          a.max_tokens,
        );
        job.delegationKey = a.idempotency_key;
        this.store.save();
        this.runner.wake();
        return { jobId: job.id, sessionId: session.id, status: job.status };
      }
    }
  }
}
