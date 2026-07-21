import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  acceptedWebhookEvent,
  webhookDedupeKey,
} from "../src/lib/atlas/huggingface";

const http = httpRouter();

function secureEqual(actual: string | null, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function validWebhookSecret(actual: string | null): boolean {
  const secrets = [
    process.env.HF_WEBHOOK_SECRET,
    process.env.HF_WEBHOOK_SECRET_PREVIOUS,
  ].filter((secret): secret is string => Boolean(secret));
  return secrets.some((secret) => secureEqual(actual, secret));
}

http.route({
  path: "/webhooks/huggingface",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validWebhookSecret(request.headers.get("X-Webhook-Secret"))) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return new Response("Malformed JSON", { status: 400 });
    }
    const event = acceptedWebhookEvent(payload);
    const dedupeKey = webhookDedupeKey(payload);
    if (!event.accepted) {
      const malformed = event.reason === "missing required webhook fields";
      return Response.json(
        { accepted: false, status: malformed ? "rejected" : "ignored", reason: event.reason },
        { status: malformed ? 400 : 202 },
      );
    }
    if (!dedupeKey || !event.repoId || !event.repoName || !event.owner || !event.scope || !event.action) {
      return Response.json({ accepted: false, reason: event.reason ?? "invalid payload" }, { status: 400 });
    }

    const result = await ctx.runMutation(internal.webhooks.receive, {
      dedupeKey,
      repoId: event.repoId,
      repoName: event.repoName,
      owner: event.owner,
      scope: event.scope,
      action: event.action,
      headSha: event.headSha,
      payload,
      receivedAt: Date.now(),
    });
    if (result.status === "unmonitored") {
      return Response.json({ accepted: false, reason: "unmonitored owner" }, { status: 403 });
    }
    return Response.json({ accepted: true, status: result.status }, { status: 202 });
  }),
});

export default http;
