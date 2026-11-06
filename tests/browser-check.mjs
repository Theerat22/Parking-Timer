import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
await mkdir("docs/screenshots", { recursive: true });
const results = [];
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const size = viewport.width === 390 ? "mobile" : "desktop";
  await page.screenshot({
    path: `docs/screenshots/${size}-setup.png`,
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  results.push({ size, overflow, errors });
  for (const tab of ["history", "stats", "siri"]) {
    await page.locator(`nav:visible a[href="#${tab}"]`).click();
    await page.screenshot({
      path: `docs/screenshots/${size}-${tab}-empty.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "การตั้งค่า", exact: true }).click();
  await page.getByRole("button", { name: "มืด", exact: true }).click();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `docs/screenshots/${size}-dark-settings.png`,
    fullPage: true,
  });
  await page.close();
}
await browser.close();
await writeFile(
  "docs/screenshots/check-results.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
