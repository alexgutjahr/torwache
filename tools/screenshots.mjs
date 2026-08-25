import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSION = join(ROOT, '.output', 'chrome-mv3');
const DOCS = join(ROOT, 'docs');
const STORE = join(DOCS, 'store');

const ENTRIES = [
  { id: 'youtube', domain: 'youtube.com', includeSubdomains: true, enabled: true },
  {
    id: 'hacker-news',
    domain: 'news.ycombinator.com',
    includeSubdomains: false,
    enabled: true,
  },
  { id: 'x', domain: 'x.com', includeSubdomains: true, enabled: true },
  { id: 'reddit', domain: 'reddit.com', includeSubdomains: true, enabled: false },
];

/** @param {import('puppeteer').Page} page @param {'light' | 'dark'} theme */
async function applyTheme(page, theme) {
  await page.evaluate((choice) => localStorage.setItem('theme', choice), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished));
  });
}

/**
 * @param {import('puppeteer').Page} page
 * @param {string} name
 * @param {string} [directory]
 */
async function capture(page, name, directory = DOCS) {
  const path = /** @type {`${string}.png`} */ (join(directory, name));
  await page.screenshot({ path });
  console.log(path.slice(ROOT.length + 1));
}

const browser = await puppeteer.launch({ pipe: true, enableExtensions: [EXTENSION] });
try {
  const target = await browser.waitForTarget(
    (candidate) =>
      candidate.type() === 'service_worker' && candidate.url().endsWith('/background.js'),
  );
  const worker = await target.worker();
  assert.ok(worker);
  await worker.evaluate((entries) => {
    const extensionApi = /** @type {typeof import('wxt/browser').browser} */ (
      Reflect.get(globalThis, 'chrome')
    );
    return extensionApi.storage.local.set({ entries: { version: 1, entries } });
  }, ENTRIES);

  const extensionId = new URL(target.url()).host;
  const manager = await browser.newPage();
  await manager.setViewport({ width: 940, height: 937, deviceScaleFactor: 2 });
  await manager.goto(`chrome-extension://${extensionId}/options.html`);
  await manager.waitForFunction(() => document.querySelectorAll('[data-card]').length === 4);

  await applyTheme(manager, 'light');
  await capture(manager, 'manager-light.png');
  await applyTheme(manager, 'dark');
  await capture(manager, 'manager-dark.png');

  const blocked = await browser.newPage();
  await blocked.setViewport({ width: 940, height: 620, deviceScaleFactor: 2 });
  await blocked.goto(`chrome-extension://${extensionId}/blocked.html?host=www.youtube.com`);

  await applyTheme(blocked, 'light');
  await capture(blocked, 'blocked-light.png');
  await applyTheme(blocked, 'dark');
  await capture(blocked, 'blocked-dark.png');

  // Chrome Web Store screenshots use the same built pages and fixtures, at the
  // Store's recommended 1280×800 landscape size.
  await mkdir(STORE, { recursive: true });
  const storeManager = await browser.newPage();
  await storeManager.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await storeManager.goto(`chrome-extension://${extensionId}/options.html`);
  await storeManager.waitForFunction(
    () => document.querySelectorAll('[data-card]').length === 4,
  );
  await applyTheme(storeManager, 'light');
  await capture(storeManager, '1-blocklist.png', STORE);
  await applyTheme(storeManager, 'dark');
  await capture(storeManager, '3-dark.png', STORE);

  const storeBlocked = await browser.newPage();
  await storeBlocked.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await storeBlocked.goto(
    `chrome-extension://${extensionId}/blocked.html?host=www.youtube.com`,
  );
  await applyTheme(storeBlocked, 'light');
  await capture(storeBlocked, '2-blocked.png', STORE);
} finally {
  await browser.close();
}
