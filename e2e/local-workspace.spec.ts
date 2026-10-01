import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
let server: Server;
let url: string;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const assets: Record<string, [string, string]> = {
      "/": ["index.html", "text/html"],
      "/app.js": ["app.js", "text/javascript"],
      "/style.css": ["style.css", "text/css"],
    };
    const item = assets[req.url || "/"];
    if (!item) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader("Content-Type", item[1]);
    res.end(readFileSync(join(process.cwd(), "local-computer/dist", item[0])));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(
  async () => new Promise<void>((resolve) => server.close(() => resolve())),
);
test("streaming preserves scroll position while allowing bottom following", async ({
  page,
}) => {
  let updates = 0;
  const id = "b8244db9-a3e1-4881-84ac-441855494a81";
  await page.route("**/api/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1);
    let data: unknown;
    if (op === "get_connection") data = { connected: false };
    else if (op === "get_overview")
      data = {
        hosts: [],
        model: { status: "online", models: [{ id: "test-model" }] },
      };
    else if (op === "list_sessions")
      data = [{ id, title: "Long session", mode: "chat" }];
    else if (op === "get_session") {
      updates++;
      data = {
        id,
        title: "Long session",
        mode: "chat",
        messages: [],
        jobs: [
          {
            id: "job",
            status: "running",
            output: "Visible streamed text\n".repeat(180 + updates * 10),
            rounds: 1,
            events: [],
            usage: { completion_tokens: updates },
          },
        ],
      };
    } else data = {};
    await route.fulfill({ json: data });
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Long session", exact: true }).click();
  const transcript = page.getByLabel("Conversation transcript");
  await expect(transcript).toContainText("Visible streamed text");
  await transcript.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });
  const before = updates;
  await expect.poll(() => updates).toBeGreaterThan(before);
  expect(await transcript.evaluate((el) => el.scrollTop)).toBeLessThan(5);
  await transcript.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll"));
  });
  const next = updates;
  await expect.poll(() => updates).toBeGreaterThan(next);
  expect(
    await transcript.evaluate(
      (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
    ),
  ).toBeLessThan(80);
});
