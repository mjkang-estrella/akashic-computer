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
test("chat layout renders safe Markdown and keeps mobile controls usable", async ({
  page,
}) => {
  const id = "b8244db9-a3e1-4881-84ac-441855494a81";
  const sent: { text: string; max_tokens: number }[] = [];
  await page.route("**/api/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1);
    let data: unknown = {};
    if (op === "get_connection") data = { connected: false };
    if (op === "get_overview")
      data = {
        hosts: [],
        model: { status: "online", models: [{ id: "Local model" }] },
      };
    if (op === "list_sessions")
      data = [{ id, title: "Layout check", mode: "chat" }];
    if (op === "get_session")
      data = {
        id,
        title: "Layout check",
        mode: "chat",
        messages: [
          {
            role: "user",
            content: "Explain the result and include a code example.",
          },
          {
            role: "assistant",
            content:
              "**Local execution** keeps inference on your computer.\n\n- Read device health\n- Run a bounded task\n\n```python\nprint(17 * 19)\n```\n\n| Model | Status |\n| --- | --- |\n| Local | Ready |\n\n<script>window.untrusted=true</script>\n\n![tracking](https://example.org/pixel.png)",
          },
        ],
        jobs: [
          {
            id: "job",
            status: "succeeded",
            rounds: 1,
            events: [],
            usage: { completion_tokens: 80 },
          },
        ],
      };
    if (op === "send_message") {
      sent.push(route.request().postDataJSON());
      data = { jobId: "job", status: "queued" };
    }
    await route.fulfill({ json: data });
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Layout check", exact: true }).click();
  await expect(page.locator(".ac-markdown strong")).toHaveText(
    "Local execution",
  );
  await expect(page.locator(".ac-code-block pre")).toContainText(
    "print(17 * 19)",
  );
  await expect(
    page.getByRole("button", { name: "Copy code", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ac-markdown table")).toBeVisible();
  await expect(
    page.locator(".ac-markdown img,.ac-markdown script"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await expect(page.locator(".ac-workspace")).toHaveAttribute(
    "data-collapsed",
    "true",
  );
  await page
    .getByRole("button", { name: "Toggle conversations", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Toggle conversations", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Conversations" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Toggle conversations", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("dialog", { name: "Conversations" }),
  ).toBeHidden();
  const input = page.getByRole("textbox", { name: "Message your local model" });
  await input.fill("Line one");
  await input.press("Shift+Enter");
  await input.pressSequentially("Line two");
  await input.press("Enter");
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].text).toBe("Line one\nLine two");
  expect(sent[0].max_tokens).toBe(8192);
  await expect(page.getByLabel("Generation settings")).toHaveCount(0);
  const composer = await page.locator(".ac-composer").boundingBox();
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(844);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
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
