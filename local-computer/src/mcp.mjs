import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stateDir, loadConfig } from "./config.mjs";
import { schemas, jobIdSchema } from "./service.mjs";

const config = loadConfig();
const token = readFileSync(join(stateDir, "token"), "utf8").trim();
const server = new McpServer(
  { name: "akashic-local", version: "0.4.0" },
  {
    instructions:
      "Open Akashic Computer for independent conversations with the local model. Panel interactions do not require your reasoning. Delegate only when requested; read results only when the user wants them in this conversation. Never poll continuously. The local agent has read-only fleet tools, not arbitrary shell access.",
  },
);
const uri = "ui://akashic-local/workspace-v1.html";
async function api(name, args) {
  const r = await fetch(`http://127.0.0.1:${config.port}/api/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(45000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
const result = (data) => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
  structuredContent: { data },
});
const failure = (e) => ({
  isError: true,
  content: [{ type: "text", text: e.message }],
});
registerAppResource(
  server,
  "Akashic Computer workspace",
  uri,
  {},
  async () => ({
    contents: [
      {
        uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: readFileSync(
          fileURLToPath(new URL("../dist/widget.html", import.meta.url)),
          "utf8",
        ),
        _meta: {
          ui: {
            prefersBorder: false,
            csp: { connectDomains: [], resourceDomains: [] },
          },
          "openai/ui": {
            availableDisplayModes: ["fullscreen"],
            preferredDisplayMode: "fullscreen",
          },
          "openai/widgetDescription":
            "Independent local model conversations and live fleet observations. Messages stay in the app unless explicitly shared.",
        },
      },
    ],
  }),
);
registerAppTool(
  server,
  "open_workspace",
  {
    title: "Open Akashic Computer",
    description:
      "Open independent local-model chat and the LAN fleet dashboard. Does not return private session transcripts to the conversation.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    _meta: {
      ui: { resourceUri: uri },
      "openai/ui": { entrypoints: [{ type: "global" }, { type: "thread" }] },
      "openai/outputTemplate": uri,
    },
  },
  async () =>
    result({
      status: "Open the workspace to chat directly with your local model.",
    }),
);

const descriptions = {
  get_connection: "Read whether this controller is paired to an account.",
  account_overview: "Read the account fleet owned by this connector.",
  account_sessions: "List account conversations for this controller.",
  account_session: "Read one account conversation for this controller.",
  account_create: "Create an account conversation.",
  account_send: "Submit an account-backed local inference job.",
  account_cancel: "Cancel an account-backed local inference job.",
  get_overview: "Read enrolled fleet health and configured local models.",
  list_sessions: "List local conversation titles.",
  create_session: "Create a persistent local conversation.",
  get_session: "Read a local conversation and its jobs.",
  send_message: "Queue a message for the local model; returns immediately.",
  get_job: "Read progress and local output for a job.",
  cancel_job: "Cancel a queued or running local job.",
};
for (const [name, description] of Object.entries(descriptions)) {
  server.registerTool(
    name,
    {
      description,
      inputSchema: schemas[name].shape,
      annotations: {
        readOnlyHint: [
          "get_connection",
          "account_overview",
          "account_sessions",
          "account_session",
          "get_overview",
          "list_sessions",
          "get_session",
          "get_job",
        ].includes(name),
        destructiveHint: ["cancel_job", "account_cancel"].includes(name),
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/visibility": "private",
        "openai/widgetAccessible": true,
      },
    },
    async (args) => {
      try {
        return {
          content: [{ type: "text", text: "Updated the local workspace." }],
          _meta: { data: await api(name, args) },
        };
      } catch (e) {
        return failure(e);
      }
    },
  );
}
server.registerTool(
  "delegate_task",
  {
    description:
      "Delegate a bounded task to the local model with read-only fleet tools. Returns a job ID immediately. No cloud model calls or arbitrary command execution.",
    inputSchema: schemas.delegate_task.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (a) => {
    try {
      return result(await api("delegate_task", a));
    } catch (e) {
      return failure(e);
    }
  },
);
server.registerTool(
  "get_task_status",
  {
    description:
      "Read a local delegated task status on request. Does not return its transcript. Do not repeatedly poll during a ChatGPT turn.",
    inputSchema: { job_id: jobIdSchema },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (a) => {
    try {
      const j = await api("get_job", a);
      return result({
        id: j.id,
        status: j.status,
        rounds: j.rounds,
        error: j.error,
      });
    } catch (e) {
      return failure(e);
    }
  },
);
server.registerTool(
  "get_task_result",
  {
    description:
      "Bring the selected local task result into this conversation only when the user requests it. Returns the answer and provenance, not internal tool observations.",
    inputSchema: { job_id: jobIdSchema },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (a) => {
    try {
      const j = await api("get_job", a);
      return result({
        id: j.id,
        status: j.status,
        answer: j.output.slice(0, 24000),
        truncated: j.output.length > 24000,
        model: j.model,
        usage: j.usage,
        error: j.error,
      });
    } catch (e) {
      return failure(e);
    }
  },
);
server.connect(new StdioServerTransport()).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
