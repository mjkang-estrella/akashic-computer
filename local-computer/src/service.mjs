import { z } from "zod";
import { cloudCall, cloudConfig } from "./cloud.mjs";
export const jobIdSchema = z.union([
  z.string().uuid(),
  z.string().regex(/^cloud:[a-z0-9]+$/),
]);
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
    max_tokens: z.number().int().min(128).max(8192).default(8192),
  }),
  get_job: z.object({ job_id: jobIdSchema }),
  cancel_job: z.object({ job_id: jobIdSchema }),
  delegate_task: z.object({
    brief: z.string().min(1).max(16000),
    idempotency_key: z.string().min(8).max(100),
    max_tokens: z.number().int().min(128).max(8192).default(8192),
  }),
};
export class Service {
  constructor(store, fleet, runner, config = {}, options = {}) {
    this.store = store;
    this.fleet = fleet;
    this.runner = runner;
    this.clientOnly = config.relayEnabled === false;
    this.cloudCall = options.request || cloudCall;
    this.cloudConfig = options.paired || cloudConfig;
  }
  async call(name, raw) {
    if (!schemas[name]) throw new Error("Unknown operation");
    const a = schemas[name].strict().parse(raw);
    switch (name) {
      case "get_connection":
        return {
          connected: !!this.cloudConfig(),
          site: this.cloudConfig()?.site || null,
          clientOnly: this.clientOnly,
        };
      case "account_overview":
        return this.cloudCall("client-read", { operation: "overview" });
      case "account_sessions":
        return this.cloudCall("client-read", { operation: "sessions" });
      case "account_session":
        return this.cloudCall("client-read", {
          operation: "session",
          conversationId: a.id,
        });
      case "account_create":
        return this.cloudCall("client-write", { operation: "create", ...a });
      case "account_send":
        return this.cloudCall("client-write", { operation: "send", ...a });
      case "account_cancel":
        return this.cloudCall("client-write", { operation: "cancel", ...a });
      case "get_overview": {
        if (this.clientOnly)
          return {
            hosts: [],
            model: { models: [], status: "client-only" },
            activeJobs: 0,
          };
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
        if (this.clientOnly)
          throw new Error(
            "This device is a client. Use Account to run jobs on the controller.",
          );
        return this.store.createSession(a.title, a.mode);
      case "get_session":
        return {
          ...this.store.session(a.session_id),
          jobs: this.store.data.jobs.filter(
            (j) => j.sessionId === a.session_id,
          ),
        };
      case "send_message": {
        if (this.clientOnly)
          throw new Error(
            "Device-only history is read-only here. Use an Account conversation.",
          );
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
        if (a.job_id.startsWith("cloud:"))
          return this.cloudCall("client-read", {
            operation: "job",
            jobId: a.job_id.slice(6),
          });
        return this.store.job(a.job_id);
      case "cancel_job":
        if (a.job_id.startsWith("cloud:"))
          return this.cloudCall("client-write", {
            operation: "cancel",
            jobId: a.job_id.slice(6),
          });
        return this.runner.cancel(a.job_id);
      case "delegate_task": {
        if (this.clientOnly)
          return this.cloudCall("client-write", {
            operation: "delegate",
            text: a.brief,
            key: a.idempotency_key,
            maxTokens: a.max_tokens,
          });
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
