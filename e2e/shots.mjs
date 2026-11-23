/* global window */
// Dev helper (not a test): screenshots the morning card on desktop and phone from the dev server.
// Usage: node e2e/shots.mjs [url]   (defaults to http://localhost:5186/)
import { chromium, devices } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:5186/";
const out = process.argv[3] ?? "test-results";
const lastNight = process.argv.includes("--last");
const browser = await chromium.launch();
for (const [name, opts] of [
  ["desktop", { viewport: { width: 1280, height: 800 } }],
  ["phone", devices["Pixel 7"]],
]) {
  const page = await browser.newPage(opts);
  await page.goto(url);
  await page.getByRole("button", { name: "Start the night" }).click();
  await page.waitForTimeout(500);
  // --last: skip ahead through the farm and town to the city's morning.
  for (let i = 0; lastNight && i < 2; i++) {
    await page.evaluate(() => (window.__nv.state.time = window.__nv.state.duration - 0.1));
    await page.getByRole("button", { name: /Fly to/ }).click({ timeout: 10000 });
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    const s = window.__nv.state;
    Object.assign(s, { score: 245, xp: 245, level: 2 });
    Object.assign(s.collected, { chicken: 3, cow: 2, sheep: 1, hay: 1 });
    s.time = s.duration - 0.1;
  });
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/morning-${name}${lastNight ? "-last" : ""}.png` });
  await page.close();
}
await browser.close();
