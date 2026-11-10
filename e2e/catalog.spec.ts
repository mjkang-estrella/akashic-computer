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
