import { expect, test } from "@playwright/test";

test("starts without a memory budget and applies named hardware", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No memory budget set.")).toBeVisible();
  await page.getByRole("button", { name: "Choose your hardware" }).click();
  await page.getByRole("combobox", { name: "Hardware" }).selectOption("mac64");
  await expect(page.getByText(/About 48 GB of 64 GB is GPU-addressable/)).toBeVisible();
  await expect(page.getByText(/^48 GB: \d+ of \d+ model sizes have an artifact estimated to fit/)).toBeVisible();

  // An explicit choice is remembered across visits; clearing it forgets it.
  await page.reload();
  await expect(page.getByLabel("Memory budget, 48 GB")).toBeVisible();
  await page.getByLabel("Memory budget, 48 GB").click();
  await page.getByRole("button", { name: "Clear budget" }).click();
  await expect(page.getByText("No memory budget set.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No memory budget set.")).toBeVisible();
});

test("offers copyable run commands bounded by the selected context", async ({ page }) => {
  await page.goto("/models/glm-glm-5-3-flash-321b");
  const artifacts = page.getByRole("region", { name: "Available artifacts" });
  await artifacts.getByRole("button", { name: "8K", exact: true }).click();
  await artifacts.getByLabel("Run zai-org/GLM-5.3-Flash locally").click();
  await expect(artifacts.getByText("vllm serve zai-org/GLM-5.3-Flash --max-model-len 8192", { exact: true })).toBeVisible();
  await expect(artifacts.getByRole("button", { name: "Copy vLLM command" }).first()).toBeVisible();
});

test("serves crawlable model pages, real 404s, sitemap and feeds", async ({ page, request }) => {
  const model = await request.get("/models/glm-glm-5-3-flash-321b");
  expect(model.status()).toBe(200);
  const html = await model.text();
  expect(html).toContain("<title>GLM 5.3 Flash 321B · Akashic Computer</title>");
  expect(html).toContain('rel="canonical" href="https://akashic.computer/models/glm-glm-5-3-flash-321b"');
  expect(html).toContain("Available artifacts");

  expect((await request.get("/models/not-a-real-model")).status()).toBe(404);
  expect((await request.get("/docs/not-a-real-doc")).status()).toBe(404);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://akashic.computer/models/glm-glm-5-3-flash-321b</loc>");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://akashic.computer/sitemap.xml");

  const feed = await request.get("/feed.xml");
  expect(feed.headers()["content-type"]).toContain("application/rss+xml");
  expect(await feed.text()).toContain("<rss version=\"2.0\"");
  expect((await request.get("/models/glm-glm-5-3-flash-321b/feed.xml")).status()).toBe(200);

  await page.goto("/models");
  await expect(page.locator("section[aria-labelledby='model-catalog-title']").getByRole("link", { name: /^Open / }).first())
    .toHaveAttribute("href", /^\/models\/[a-z0-9-]+$/);
});
