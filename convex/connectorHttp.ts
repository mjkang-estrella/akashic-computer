import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const connectorHttp = httpAction(async (ctx, request) => {
  try {
    const text = await request.text();
    if (text.length > 2000000)
      return reply({ error: "Request too large" }, 413);
    const body = JSON.parse(text);
    const op = new URL(request.url).pathname.split("/").at(-1);
    if (op === "enroll")
      return reply({
        enrollmentId: await ctx.runMutation(internal.connector.enroll, {
          codeHash: await digest(String(body.code)),
          credentialHash: String(body.credentialHash),
          name: String(body.name),
        }),
      });
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      return reply({ error: "Connector authentication required" }, 401);
    const credentialHash = await digest(token);
    if (op === "client-read")
      return reply(
        await ctx.runQuery(internal.connectorClient.read, {
          ...body,
          credentialHash,
        }),
      );
    if (op === "client-write")
      return reply(
        await ctx.runMutation(internal.connectorClient.write, {
          ...body,
          credentialHash,
        }),
      );
    if (op === "enrollment-status")
      return reply(
        await ctx.runQuery(internal.connector.enrollmentStatus, {
          id: body.id,
          credentialHash,
        }),
      );
    if (op === "heartbeat")
      return reply(
        await ctx.runMutation(internal.connector.heartbeat, {
          credentialHash,
          devices: body.devices,
          deployments: body.deployments,
          ...(body.name ? { name: body.name } : {}),
        }),
      );
    if (op === "claim")
      return reply(
        await ctx.runMutation(internal.connector.claim, {
          credentialHash,
          leaseId: body.leaseId,
        }),
      );
    if (op === "progress")
      return reply(
        await ctx.runMutation(internal.connector.progress, {
          ...body,
          credentialHash,
        }),
      );
    return reply({ error: "Unknown connector operation" }, 404);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Invalid request";
    return reply(
      {
        error:
          msg.includes("revoked") || msg.includes("not allowed")
            ? "Connector access revoked or invalid"
            : "Request rejected; check enrollment, lease, and arguments",
      },
      msg.includes("revoked") || msg.includes("not allowed") ? 401 : 400,
    );
  }
});
