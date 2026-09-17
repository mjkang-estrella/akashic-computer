import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`explores a model path and opens its exact variant at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const explorer = page.getByRole("region", {
      name: "From model family to downloadable weights",
    });
    const family = explorer.getByRole("combobox", { name: /01 Family/ });
    await expect(family).toBeVisible();
    await family.selectOption("qwen");
    const release = explorer.getByRole("combobox", { name: /02 Release/ });
    const releaseOptions = await release
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );
    expect(releaseOptions.length).toBeGreaterThan(1);
    await release.selectOption(releaseOptions[1]);
    const size = explorer.getByRole("combobox", { name: /03 Size/ });
    const selectedSlug = await size.inputValue();
    const variant = explorer.getByRole("combobox", { name: /04 Variant/ });
    const selectedVariant = await variant.inputValue();
    const inspect = explorer.getByRole("link", { name: "Inspect this model" });
    await expect(inspect).toHaveAttribute(
      "href",
      `/models/${selectedSlug}?variant=${encodeURIComponent(selectedVariant)}`,
    );
    const formatButtons = explorer
      .getByRole("button")
      .filter({ hasNotText: "All formats" });
    if (await formatButtons.count()) {
      const firstFormat = formatButtons.first();
      await firstFormat.click();
      await expect(firstFormat).toHaveAttribute("aria-pressed", "true");
      const format = await firstFormat.textContent();
      for (const row of await explorer.getByRole("listitem").all()) {
        await expect(row.getByText(format!, { exact: true })).toBeVisible();
      }
      await explorer
        .getByRole("button", { name: "All formats", exact: true })
        .click();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("homepage.png"),
      fullPage: true,
    });
    await inspect.click();
    await expect(page).toHaveURL(
      new RegExp(`/models/${selectedSlug}\\?variant=`),
    );
    await expect(
      page.getByRole("region", { name: "Available artifacts" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("use cases open the matching URL-backed catalog category", async ({
  page,
}) => {
  await page.goto("/");
  const discovery = page.getByRole("region", {
    name: "Explore by capability",
  });
  await expect(
    discovery.getByRole("link", { name: /Audio & Speech/ }),
  ).toBeVisible();
  await discovery.getByRole("link", { name: /Audio & Speech/ }).click();
  await expect(page).toHaveURL(/\/models\?category=audio-speech$/);
  await expect(
    page.getByRole("button", { name: "Remove Audio & Speech filter" }),
  ).toBeVisible();
});
