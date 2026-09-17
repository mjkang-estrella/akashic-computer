import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`introduces the product and connects each preview to its tools at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your way through open-weight AI.");
    await expect(page.getByRole("link", { name: "Explore models", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start learning", exact: true })).toHaveAttribute("href", "/docs");
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.getByRole("searchbox")).toHaveCount(0);

    const discover = page.getByRole("tabpanel", { name: "Discover", exact: true });
    const firstModel = discover.getByRole("link", { name: /^Explore / }).first();
    await expect(firstModel).toBeVisible();
    const modelHref = await firstModel.getAttribute("href");
    await page.screenshot({ path: testInfo.outputPath("landing-discover.png"), fullPage: true });

    await page.getByRole("tab", { name: "Discover", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    const compareTab = page.getByRole("tab", { name: "Compare", exact: true });
    await expect(compareTab).toBeFocused();
    await expect(compareTab).toHaveAttribute("aria-selected", "true");
    const comparison = page.getByRole("tabpanel", { name: "Compare", exact: true });
    await expect(comparison.getByText("258.96 GB", { exact: true })).toBeVisible();
    await expect(comparison.getByText("120.5 GB", { exact: true })).toBeVisible();
    await expect(comparison.getByText(/Estimated weights only/)).toBeVisible();
    await expect(comparison.getByRole("link", { name: "Open this comparison" })).toHaveAttribute("href", /leftBpw=2.75.*rightBpw=3/);
    await page.screenshot({ path: testInfo.outputPath("landing-compare.png"), fullPage: true });

    await compareTab.press("End");
    await expect(page.getByRole("tab", { name: "Learn", exact: true })).toBeFocused();
    const learn = page.getByRole("tabpanel", { name: "Learn", exact: true });
    await expect(learn.getByRole("link", { name: /Quantization without the shorthand/ })).toHaveAttribute("href", "/docs/quantization");
    await page.screenshot({ path: testInfo.outputPath("landing-learn.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await learn.getByRole("link", { name: /Quantization without the shorthand/ }).click();
    await expect(page.getByRole("heading", { name: "Quantization without the shorthand", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Akashic home", exact: true }).click();
    const tradeoff = page.getByRole("region", { name: "More model, or more precision?" });
    await tradeoff.scrollIntoViewIfNeeded();
    await expect(tradeoff.getByText("138.46 GB", { exact: true })).toBeVisible();
    await tradeoff.getByRole("link", { name: "Compare these models", exact: true }).click();
    await expect(page).toHaveURL(/\/compare\?.*leftBpw=2.75.*rightBpw=3/);
    await expect(page.getByRole("region", { name: "Comparison tradeoffs" })).toBeVisible();

    await page.getByRole("link", { name: "Akashic home", exact: true }).click();
    const learningPaths = page.getByRole("region", { name: "Understand what you’re running." });
    await learningPaths.getByRole("link", { name: "Why does a model need so much memory?" }).click();
    await expect(page).toHaveURL(/\/docs\/paths\/inference-memory$/);
    await expect(page.getByRole("heading", { name: "Account for inference memory", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Akashic home", exact: true }).click();
    await page.getByRole("tabpanel", { name: "Discover", exact: true }).getByRole("link", { name: /^Explore / }).first().click();
    await expect(page).toHaveURL(new RegExp(`${modelHref}$`));
    await expect(page.getByRole("region", { name: "Available artifacts" })).toBeVisible();
    await page.getByRole("link", { name: "Akashic home", exact: true }).click();
    const closing = page.getByRole("region", { name: "Find your next model." });
    await closing.scrollIntoViewIfNeeded();
    await expect(closing.getByRole("link", { name: "Open the catalog" })).toHaveAttribute("href", "/models");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Explore models", exact: true }).click();
    await expect(page).toHaveURL(/\/models$/);
    await expect(page.getByRole("searchbox", { name: "Search the Akashic catalog" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("keeps the introduction and learning usable while catalog data loads", async ({ page }) => {
  await page.routeWebSocket(/convex\.cloud/, () => {});
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore models", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "", exact: true })).toContainText("Loading model preview");
  await page.getByRole("tab", { name: "Learn", exact: true }).click();
  await page.getByRole("tabpanel", { name: "Learn", exact: true }).getByRole("link", { name: /Quantization without the shorthand/ }).click();
  await expect(page.getByRole("heading", { name: "Quantization without the shorthand", exact: true })).toBeVisible();
});
