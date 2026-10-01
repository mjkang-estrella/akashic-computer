import { test, expect } from "@playwright/test";

test("public catalog and gated workspace have a unified name and navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Akashic Computer home" }),
  ).toBeVisible();
  await page.goto("/workspace");
  await expect(page).toHaveTitle("Workspace · Akashic Computer");
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Models", exact: true }),
  ).toBeVisible();
});
test("workspace does not depend on catalog subscriptions", async ({ page }) => {
  const sent: string[] = [];
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => sent.push(String(frame.payload))),
  );
  await page.goto("/computers");
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  await expect(
    page.getByText("Catalog unavailable", { exact: true }),
  ).toHaveCount(0);
  expect(
    sent.some((frame) =>
      /catalog:listPublished|intelligence:listRecentChanges|catalog:healthSummary/.test(
        frame,
      ),
    ),
  ).toBe(false);
});
