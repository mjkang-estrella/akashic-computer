import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`compares GLM model scale against EXL3 precision at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/compare");
    await page.getByRole("link", { name: "Try GLM-5.3 vs Flash" }).click();
    const a = page.getByRole("region", { name: "Scenario A", exact: true });
    const b = page.getByRole("region", { name: "Scenario B", exact: true });
    // Live parameter counts retain more precision than the rounded 753B/321B labels.
    await expect(a.getByText("258.96 GB", { exact: true })).toBeVisible();
    await expect(b.getByText("120.5 GB", { exact: true })).toBeVisible();
    const tradeoffs = page.getByRole("region", { name: "Comparison tradeoffs" });
    await expect(tradeoffs.getByText(/Option B uses 9.09% more bits per weight/)).toBeVisible();
    await expect(tradeoffs.getByText(/No quality verdict/)).toBeVisible();
    await expect(tradeoffs.getByText(/6.45 bpw/)).toBeVisible();
    await page.getByLabel("Weight budget (GB)", { exact: true }).fill("192");
    await expect(a.getByText("66.96 GB above the weight budget", { exact: true })).toBeVisible();
    await expect(b.getByText("71.5 GB left in the weight budget", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("comparison-planner.png"), fullPage: true });
    await a.getByLabel("Target bits per weight A").fill("2.5");
    await expect(page.getByRole("link", { name: "Open saved view", exact: true })).toHaveAttribute("href", /leftBpw=2.5.*budget=192/);
    await page.getByRole("link", { name: "Open saved view", exact: true }).click();
    await expect(page).toHaveURL(/leftBpw=2.5.*budget=192/);
    await page.reload();
    await expect(a.getByLabel("Target bits per weight A")).toHaveValue("2.5");
    await expect(page.getByLabel("Weight budget (GB)", { exact: true })).toHaveValue("192");
    await a.getByLabel("Target bits per weight A").fill("");
    await expect(a.getByRole("alert")).toHaveText("Enter a target above 0 and at most 16 bpw.");
    await expect(tradeoffs).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("does not replace an unavailable model from a shared URL", async ({ page }) => {
  await page.goto("/compare?left=removed-model&leftBpw=2.75&right=glm-glm-5-3-flash-321b&rightBpw=3");
  await expect(page.getByRole("region", { name: "Scenario A", exact: true }).getByRole("alert")).toContainText("This model is no longer in the published catalog");
  await expect(page.getByRole("region", { name: "Comparison tradeoffs" })).toHaveCount(0);
});
