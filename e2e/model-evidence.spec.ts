import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`separates model identity, memory evidence and recipes at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/models/glm-glm-5-3-flash-321b");
    const artifacts = page.getByRole("region", { name: "Available artifacts" });
    const recipes = page.getByRole("region", { name: "Runtime recipes" });
    await expect(artifacts.getByRole("checkbox", { name: "Compare zai-org/GLM-5.3-Flash", exact: true })).toBeVisible();
    await expect(artifacts.getByRole("checkbox", { name: "Compare zai-org/GLM-5.3", exact: true })).toHaveCount(0);
    await expect(artifacts.getByText(/Fits 384/)).toHaveCount(0);
    await expect(artifacts.getByText("328 GB weights", { exact: true }).first()).toBeVisible();
    await expect(artifacts.getByText(/12 GB KV estimate/).first()).toBeVisible();
    await expect(artifacts.getByRole("link", { name: "vLLM recipe condition · 386 GB", exact: true })).toBeVisible();
    await expect(recipes.getByText("Official vLLM recipe · GLM-5.3-Flash", { exact: true })).toBeVisible();
    await expect(recipes.getByText("Official vLLM recipe · GLM-5.3", { exact: true })).toHaveCount(0);
    await expect(artifacts.getByText(/Official vLLM recipe/)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("detail.png"), fullPage: true });

    await artifacts.getByRole("checkbox", { name: "Compare zai-org/GLM-5.3-Flash", exact: true }).check();
    await artifacts.getByRole("checkbox", { name: "Compare zai-org/GLM-5.3-Flash-BF16", exact: true }).check();
    const comparison = page.getByRole("region", { name: "Artifact comparison" });
    await expect(comparison.getByRole("heading", { name: "Compare artifacts · 2 selected" })).toBeVisible();
    await expect(comparison.getByText(/No benchmark delta data/)).toBeVisible();
    await expect(comparison.getByText(/340–340/)).toHaveCount(0);
    await expect(comparison.getByText("n/a", { exact: true })).toHaveCount(0);
    await expect(comparison.getByRole("img", { name: "Runtime fit unverified" }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("comparison.png"), fullPage: true });
    await page.getByRole("button", { name: "Models", exact: true }).click();
    await expect(comparison.getByRole("heading", { name: "Compare artifacts · 2 selected" })).toBeVisible();
    await comparison.getByRole("button", { name: "Clear artifact comparison" }).click();
    await expect(comparison).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("keeps regular GLM-5.3 checkpoints and recipes on its own detail page", async ({ page }) => {
  await page.goto("/models/glm-glm-5-3-753b");
  await expect(page.getByRole("heading", { name: "GLM 5.3 753B", exact: true })).toBeVisible();
  const artifacts = page.getByRole("region", { name: "Available artifacts" });
  await expect(artifacts.getByRole("checkbox", { name: "Compare zai-org/GLM-5.3", exact: true })).toBeVisible();
  await expect(artifacts.getByRole("checkbox", { name: /Flash/ })).toHaveCount(0);
  const recipes = page.getByRole("region", { name: "Runtime recipes" });
  await expect(recipes.getByText("Official vLLM recipe · GLM-5.3", { exact: true })).toBeVisible();
  await expect(recipes.getByText(/Flash/)).toHaveCount(0);
});
