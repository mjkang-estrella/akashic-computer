import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`investigates primary resources and preserves reading progress at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "Learn how models run." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resource library", exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("study-hub.png"), fullPage: true });
    await page.getByRole("link", { name: /Larger model or higher bpw/ }).click();
    await expect(page).toHaveURL(/\/docs\/paths\/quantization#investigation$/);
    await expect(page.getByRole("heading", { name: "Investigate GLM versus Flash" })).toBeVisible();
    await expect(page.getByRole("link", { name: "EXL3 conversion settings (opens in a new tab)" })).toHaveAttribute("href", "https://github.com/turboderp-org/exllamav3/blob/master/doc/convert.md");
    await page.getByRole("button", { name: "Mark EXL3 conversion settings as read", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("1 of 4 resources read");
    await page.reload();
    await expect(page.getByRole("button", { name: "Mark EXL3 conversion settings as unread", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "Study / Docs", exact: false }).click();
    await page.getByRole("button", { name: "Resource library", exact: true }).click();
    const library = page.getByRole("region", { name: "Resource library", exact: true });
    await library.getByRole("searchbox", { name: "Search study resources" }).fill("EXL3 calibration");
    await library.getByLabel("Resource topic", { exact: true }).selectOption("Quantization");
    await expect(library.getByRole("status")).toHaveText("1 resource");
    await expect(library.getByRole("button", { name: "Mark EXL3 conversion settings as unread", exact: true })).toBeVisible();
    await library.getByRole("checkbox", { name: "Unread only" }).check();
    await expect(library.getByRole("heading", { name: "No resources match these filters" })).toBeVisible();
    await library.getByRole("button", { name: "Reset filters" }).click();
    await expect(library.getByRole("status")).toHaveText("20 resources");
    await page.getByRole("button", { name: "Akashic guides", exact: true }).click();
    await page.getByRole("link", { name: /Quantization without the shorthand/ }).click();
    await expect(page).toHaveURL(/\/docs\/quantization$/);
    await expect(page.getByRole("heading", { name: "Quantization without the shorthand", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Compare quantized checkpoints/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("connects the investigation to the current GLM-versus-Flash preset", async ({ page }) => {
  await page.goto("/docs/paths/quantization#investigation");
  const planner = page.getByRole("link", { name: "Open the comparison planner", exact: false });
  await expect(planner).toHaveAttribute("href", /leftBpw=2.75.*rightBpw=3/);
  await planner.click();
  await expect(page).toHaveURL(/\/compare\?.*leftBpw=2.75.*rightBpw=3/);
  await expect(page.getByRole("region", { name: "Comparison tradeoffs" })).toBeVisible();
});

test("keeps progress usable during the session when storage writes are blocked", async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "akashic:study-read:v1") throw new DOMException("Blocked", "SecurityError");
      return setItem.call(this, key, value);
    };
  });
  await page.goto("/docs/paths/quantization");
  await page.getByRole("button", { name: "Mark EXL3 conversion settings as read", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 of 4 resources read");
  await page.getByRole("link", { name: "Study / Docs", exact: false }).click();
  await page.getByRole("button", { name: "Resource library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark EXL3 conversion settings as unread", exact: true })).toBeVisible();
});
