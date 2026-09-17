import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`keeps navigation consistent across product routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Find your way through open-weight AI." })).toBeVisible();
    const navigation = page.getByRole("navigation", { name: "Primary" });
    await expect(navigation.getByRole("link")).toHaveText(["Discover", "Compare", "Benchmarks", "Learn"]);
    const headerBounds = await page.getByRole("banner").boundingBox();
    const navBounds = await navigation.boundingBox();
    for (const link of await navigation.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(64);
      await expect(link.locator("svg")).toBeVisible();
    }

    for (const [label, href, heading] of [
      ["Discover", "/models", "Models"],
      ["Compare", "/compare", "More model or more precision?"],
      ["Benchmarks", "/benchmarks", "Open model leaderboards"],
      ["Learn", "/docs", "Learn how models run."],
    ]) {
      const link = navigation.getByRole("link", { name: label, exact: true });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(link).toHaveAttribute("aria-current", "page");
      expect(await page.getByRole("banner").boundingBox()).toEqual(headerBounds);
      expect(await navigation.boundingBox()).toEqual(navBounds);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    const search = page.getByRole("searchbox", { name: "Search the Akashic catalog" });
    await search.fill("glm");
    await navigation.getByRole("link", { name: "Discover", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(page.getByRole("heading", { name: "Models", exact: true })).toBeVisible();
  });
}

test("keeps model filters in one URL-backed state", async ({ page }) => {
  await page.goto("/models");
  const filters = page.getByRole("complementary", { name: "Model filters" });
  await filters.getByRole("button", { name: /Audio & Speech/ }).click();
  await expect(page).toHaveURL(/category=audio-speech/);
  await expect(filters.getByRole("button", { name: /Audio & Speech/ })).toHaveAttribute("aria-pressed", "true");

  await filters.getByRole("button", { name: /Language/ }).click();
  await expect(page).toHaveURL(/category=language/);
  await expect(filters.getByRole("button", { name: /Language/ })).toHaveAttribute("aria-pressed", "true");

  await filters.getByRole("button", { name: /All models/ }).click();
  await expect(page).toHaveURL(/\/models$/);
  await expect(filters.getByRole("button", { name: /All models/ })).toHaveAttribute("aria-pressed", "true");
});

test("loads model details through the detail query", async ({ page }) => {
  await page.goto("/models");
  const firstModel = page
    .locator("section[aria-labelledby='model-catalog-title']")
    .getByRole("button", { name: /^Open / })
    .first();
  await expect(firstModel).toBeVisible();
  await firstModel.click();
  await expect(page).toHaveURL(/\/models\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available artifacts" })).toBeVisible();
  await page.getByRole("button", { name: "Models", exact: true }).click();
  await expect(page).toHaveURL(/\/models$/);
});

test("shows official vLLM and SGLang recipes for an exact model match", async ({ page }) => {
  await page.goto("/models/glm-glm-5-3-flash-321b");
  await expect(page.getByRole("heading", { name: /GLM 5\.3 Flash/ })).toBeVisible();
  await expect(page.getByText(/Official vLLM recipe/).first()).toBeVisible();
  await expect(page.getByText(/Official SGLang recipe/).first()).toBeVisible();
});

test("does not translate retired query-string tabs", async ({ page }) => {
  await page.goto("/?tab=model");
  await expect(page.getByRole("heading", { name: "Find your way through open-weight AI." })).toBeVisible();
  await expect(page).toHaveURL(/\?tab=model$/);
});
