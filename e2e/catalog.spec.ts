import { expect, test } from "@playwright/test";

test("navigates through dedicated product routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Open-weight models, organized." })).toBeVisible();

  await page.getByRole("link", { name: "Models", exact: true }).click();
  await expect(page).toHaveURL(/\/models$/);
  await expect(page.getByRole("heading", { name: "Models", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Benchmarks", exact: true }).click();
  await expect(page).toHaveURL(/\/benchmarks$/);
  await expect(page.getByRole("heading", { name: "Open model leaderboards" })).toBeVisible();

  await page.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole("heading", { name: "Technical guides to local models" })).toBeVisible();
});

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
    .getByRole("link", { name: /^Open / })
    .first();
  await expect(firstModel).toBeVisible();
  await firstModel.click();
  await expect(page).toHaveURL(/\/models\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available artifacts" })).toBeVisible();
  await page.getByRole("link", { name: "Models", exact: true }).click();
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
  await expect(page.getByRole("heading", { name: "Open-weight models, organized." })).toBeVisible();
  await expect(page).toHaveURL(/\?tab=model$/);
});


test("search has a URL and navigation leaves its results", async ({ page }) => {
  await page.goto("/models");
  const input = page.getByRole("searchbox", { name: "Search the Akashic Computer catalog" });
  await input.pressSequentially("glm");
  await expect(page).toHaveURL(/\/search\?q=glm$/);
  await expect(page.locator("#search-results").getByRole("link").first()).toBeVisible();
  await input.press("Escape");
  await expect(page).toHaveURL(/\/models$/);
  await input.fill("glm");
  await expect(page).toHaveURL(/\/search\?q=glm$/);
  await page.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.locator("#search-results")).toHaveCount(0);
  await expect(input).toHaveValue("");
});

test("direct search URLs restore their text and clear to home", async ({ page }) => {
  await page.goto("/search?q=glm");
  const input = page.getByRole("searchbox", { name: "Search the Akashic Computer catalog" });
  await expect(input).toHaveValue("glm");
  await input.fill("glm flash");
  await expect(page).toHaveURL(/q=glm%20flash$/);
  await input.fill("");
  await expect(page).toHaveURL(/\/$/);
});

test("preserves artifact selections between model detail pages", async ({ page }) => {
  await page.goto("/models/glm-glm-5-3-flash-321b");
  const artifact = page.getByRole("checkbox", { name: "Compare zai-org/GLM-5.3-Flash", exact: true });
  await artifact.check();
  const drawer = page.getByRole("region", { name: "Artifact comparison", exact: true });
  await expect(drawer).toBeVisible();
  await page.getByRole("link", { name: "Models", exact: true }).click();
  await page.locator("section[aria-labelledby='model-catalog-title']").getByRole("link", { name: /^Open / }).first().click();
  await expect(page.getByRole("heading", { name: "Available artifacts" })).toBeVisible();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Compare artifacts · 1 selected")).toBeVisible();
  await drawer.getByRole("button", { name: "Clear artifact comparison" }).click();
  await expect(drawer).toHaveCount(0);
});

test("hydrates incoming family filters and cleans unknown parameters", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/models?family=qwen&quant=not-a-quant&provider=not-a-provider&catalogVariant=not-a-variant");
  const filters = page.getByRole("complementary", { name: "Model filters" });
  await expect(filters.getByRole("combobox", { name: "Family", exact: true })).toHaveValue("qwen");
  await expect(filters.getByRole("combobox", { name: "Quantization", exact: true })).toHaveValue("all");
  await expect(page.getByRole("button", { name: /Remove .*Qwen.* filter/ })).toBeVisible();
  await filters.getByRole("combobox", { name: "Parameters", exact: true }).selectOption("compact");
  await expect(page).toHaveURL(/family=qwen&size=compact$/);
  expect(errors.filter((message) => /hydration|didn't match|did not match/i.test(message))).toEqual([]);
});

test("limits rows and resets the window when filters change", async ({ page }) => {
  await page.goto("/models");
  const rows = page.locator("section[aria-labelledby='model-catalog-title']").getByRole("link", { name: /^Open / });
  await expect(rows).toHaveCount(100);
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  await expect(rows).toHaveCount(200);
  const filters = page.getByRole("complementary", { name: "Model filters" });
  await filters.getByRole("combobox", { name: "Parameters", exact: true }).selectOption("compact");
  await expect.poll(() => rows.count()).toBeLessThanOrEqual(100);
});

test("traps mobile filter focus and restores it on close", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/models");
  const trigger = page.getByRole("button", { name: "Filters", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Filters", exact: true });
  const close = dialog.getByRole("button", { name: "Close filters", exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("combobox", { name: "Provider", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await close.click();
  await expect(trigger).toBeFocused();
});


test("responds to browser back and forward filter state", async ({ page }) => {
  await page.goto("/models?family=qwen");
  const family = page.getByRole("complementary", { name: "Model filters" }).getByRole("combobox", { name: "Family", exact: true });
  await expect(family).toHaveValue("qwen");
  // Add a separate history entry, then exercise the store's popstate subscription.
  await page.evaluate(() => {
    window.history.pushState(null, "", "/models");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(family).toHaveValue("all");
  await page.goBack();
  await expect(family).toHaveValue("qwen");
  await page.goForward();
  await expect(family).toHaveValue("all");
});

test("home links expose destinations and docs have one page heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Open-weight models, organized.");
  await expect(page.getByRole("link", { name: "View all models", exact: true })).toHaveAttribute("href", "/models");
  await expect(page.getByRole("link", { name: "View all benchmarks", exact: true })).toHaveAttribute("href", "/benchmarks");
  const model = page.getByRole("link", { name: /^Open / }).first();
  await expect(model).toHaveAttribute("href", /^\/models\//);
  await page.getByRole("link", { name: "Read the docs", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Technical guides to local models");
  await page.getByRole("link", { name: "Open lexicon", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Technical lexicon");
  await page.getByRole("link", { name: "All Docs", exact: true }).click();
  await expect(page).toHaveURL(/\/docs$/);
});

for (const width of [1280, 390, 360]) {
  test(`keeps ranked benchmarks readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/benchmarks");
    await expect(page.getByRole("heading", { name: "Open model leaderboards", level: 1 })).toBeVisible();
    const list = page.getByRole("list", { name: /ranked results/ }).first();
    await expect(list).toBeVisible();
    expect(await list.getByRole("listitem").count()).toBeLessThanOrEqual(8);
    const section = list.locator("xpath=ancestor::section");
    const disclosure = section.getByRole("button", { name: /Show all|Show top/ });
    if (await disclosure.count()) {
      await disclosure.click();
      await expect(disclosure).toHaveAttribute("aria-expanded", "true");
      await disclosure.click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
