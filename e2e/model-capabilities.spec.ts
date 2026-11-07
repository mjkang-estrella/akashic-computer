import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`shows sourced capability columns without disrupting artifacts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/models/glm-glm-5-3-flash-321b");
    const capability = page.getByRole("region", { name: "Capability", exact: true });
    await expect(capability).toBeVisible();
    await expect(capability.locator("figure")).toHaveCount(3);
    await expect(capability.getByText("AA Intelligence", { exact: true }).first()).toBeVisible();
    await expect(capability.getByText("Terminal-Bench 4.0", { exact: true }).first()).toBeVisible();
    await expect(capability.getByText("HLE-Diamond", { exact: true }).first()).toBeVisible();
    await expect(capability.locator('svg rect[fill="var(--meta)"]')).toHaveCount(6);
    await expect(capability.getByText("2026-11-06", { exact: false }).last()).toBeVisible();
    const figures = await capability.locator("figure").evaluateAll(nodes => nodes.map(n => ({ x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y })));
    if (width > 700) expect(new Set(figures.map(f => f.y)).size).toBe(1);
    else expect(new Set(figures.map(f => f.x)).size).toBe(1);
    await capability.getByLabel("Closed anchors").uncheck();
    await expect(capability.locator("svg g title")).toHaveCount(9);
    await capability.getByText("Sources & evaluation settings", { exact: true }).click();
    await expect(capability.getByRole("link", { name: /GLM-5.3-Flash/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Available artifacts" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Runtime recipes" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
