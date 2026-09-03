import { expect, test } from "@playwright/test";

test("navigates through dedicated product routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Open-weight models, organized." })).toBeVisible();

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await expect(page).toHaveURL(/\/models$/);
  await expect(page.getByRole("heading", { name: "Models", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Benchmark", exact: true }).click();
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
  await expect(page.getByRole("heading", { name: "Open-weight models, organized." })).toBeVisible();
  await expect(page).toHaveURL(/\?tab=model$/);
});
