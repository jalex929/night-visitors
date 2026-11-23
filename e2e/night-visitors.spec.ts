import { expect, test } from "@playwright/test";

test("a short night goes from the title to the morning, then on to town", async ({ page }) => {
  await page.goto("./?night=15");
  await expect(page.getByRole("heading", { name: "Night Visitors" })).toBeVisible();
  await page.getByRole("button", { name: "Start the night" }).click();

  await expect(page.getByText("Sunrise in")).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("img", { name: /Farm at night/ })).toBeVisible();
  await page.screenshot({ path: `test-results/night-${test.info().project.name}.png` });

  // Beam for a moment; the night ends on its own.
  await page.keyboard.down("Space");
  await page.waitForTimeout(800);
  await page.keyboard.up("Space");

  await expect(page.getByRole("heading", { name: "Home by morning" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("final-score")).toContainText("points");
  await page.screenshot({ path: `test-results/morning-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Fly to town" }).click();
  await expect(page.getByText("Sunrise in")).toBeVisible();
  await expect(page.getByText("Night 2")).toBeVisible();
  await expect(page.getByRole("img", { name: /Town at night/ })).toBeVisible();
});

test("pause stops the clock and keeps the night", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start the night" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  const dialog = page.getByRole("dialog", { name: "Paused" });
  await expect(dialog).toBeVisible();
  const before = await page.getByTestId("time").textContent();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("time")).toHaveText(before ?? "");
  await dialog.getByRole("button", { name: "Keep going" }).click();
  await expect(dialog).toBeHidden();
});
