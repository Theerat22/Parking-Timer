import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3002",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3002")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (i === 59) throw new Error("Production server not ready");
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:3002", { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    true,
  );
  const manifest = await (
    await page.request.get("http://127.0.0.1:3002/manifest.webmanifest")
  ).json();
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons)
    assert.equal(
      (await page.request.get("http://127.0.0.1:3002" + icon.src)).status(),
      200,
    );
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = (
      await Promise.all(
        keys.map(async (k) =>
          (await (await caches.open(k)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat();
    return requests;
  });
  assert.ok(!cached.some((path) => path.startsWith("/api/")));
  await page.context().setOffline(true);
  await page.goto("http://127.0.0.1:3002/");
  await page.getByRole("heading", { name: "ไม่มีอินเทอร์เน็ต" }).waitFor();
  console.log(
    "PASS: production service worker controls page; manifest/icons valid; offline navigation truthful; no API cache",
  );
} finally {
  await browser?.close();
  app.kill("SIGTERM");
}
