import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { expect, test } from 'vitest';
import type { browser as BrowserApi } from 'wxt/browser';

// Puppeteer evaluates these callbacks inside the extension page, where Chrome
// exposes its API as `chrome`. WXT's browser type keeps the test aligned with
// the same cross-browser API contract used by the extension itself.
declare const chrome: typeof BrowserApi;

interface StoredBlocklist {
  version: number;
  entries: Array<{ domain: string }>;
}

interface ExtensionStorage {
  entries?: StoredBlocklist;
}

type StorageGetKeys = string | string[] | null | undefined;
type StorageItems = Record<string, unknown>;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXTENSION = join(ROOT, '.output', 'chrome-mv3');

/**
 * Chrome startup, MV3 service-worker wakeups, navigation interception, and
 * declarativeNetRequest writes can all stall briefly under load. Keep one
 * generous deadline for those browser operations so a fast assertion is not
 * made flaky by the machine running it.
 */
const CHROME_TIMEOUT = 20_000;

function launchExtension(...args: string[]): Promise<Browser> {
  return puppeteer.launch({
    pipe: true,
    enableExtensions: [EXTENSION],
    args: [
      ...args,
      // A CI runner has no user namespaces for Chrome's sandbox and a small
      // /dev/shm, so the browser dies on launch without these. Left off
      // locally, where the sandbox works and is worth keeping.
      ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
    ],
  });
}

async function clickWhenReady(page: Page, selector: string): Promise<void> {
  await page.locator(selector).setTimeout(CHROME_TIMEOUT).click();
}

test('the unpacked extension manages and enforces a blocklist in Chrome', {
  timeout: 60_000,
}, async () => {
  const server = createServer((_request, response) => {
    response.end('the block rule did not run');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(undefined));
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  let browser: Browser | undefined;

  try {
    browser = await launchExtension('--host-resolver-rules=MAP blocked.test 127.0.0.1');
    const workerTarget = await browser.waitForTarget(
      (target) => target.type() === 'service_worker' && target.url().endsWith('/background.js'),
      { timeout: CHROME_TIMEOUT },
    );
    const extensionId = new URL(workerTarget.url()).host;
    const manager = await browser.newPage();
    await manager.goto(`chrome-extension://${extensionId}/options.html`);

    await manager.type('#domain', 'blocked.test');
    await manager.click('#add-form button[type="submit"]');
    await manager.waitForFunction(
      async () => {
        const stored = (await chrome.storage.local.get<ExtensionStorage>('entries')).entries;
        const rules = await chrome.declarativeNetRequest.getDynamicRules();
        return stored?.version === 1 && stored.entries?.length === 1 && rules.length === 1;
      },
      { timeout: CHROME_TIMEOUT },
    );

    const blocked = await browser.newPage();
    const privateUrl = `http://blocked.test:${address.port}/private?token=sensitive#fragment`;
    await blocked.goto(privateUrl, { timeout: CHROME_TIMEOUT }).catch(() => {});
    try {
      await blocked.waitForFunction(() => location.pathname.endsWith('/blocked.html'), {
        timeout: CHROME_TIMEOUT,
      });
    } catch {
      assert.fail(`blocked navigation ended at ${blocked.url()}`);
    }

    const blockedLocation = new URL(blocked.url());
    assert.equal(blockedLocation.protocol, 'chrome-extension:');
    assert.equal(blockedLocation.search, '?host=blocked.test');
    assert.ok(!blocked.url().includes('sensitive'));
    assert.equal(await blocked.$eval('#host', (node) => node.textContent), 'blocked.test');

    await manager.bringToFront();

    // Rule state is written by the service worker while the page re-renders the
    // row independently. Waiting only on the rules can hand the next click a
    // node that is about to be replaced, so wait for the row to settle too.
    await clickWhenReady(manager, '[data-toggle]');
    await manager.waitForFunction(
      async () =>
        document.querySelector('[data-toggle]')?.getAttribute('aria-checked') === 'false' &&
        (await chrome.declarativeNetRequest.getDynamicRules()).length === 0,
      { timeout: CHROME_TIMEOUT },
    );
    await clickWhenReady(manager, '[data-toggle]');
    await manager.waitForFunction(
      async () =>
        document.querySelector('[data-toggle]')?.getAttribute('aria-checked') === 'true' &&
        (await chrome.declarativeNetRequest.getDynamicRules()).length === 1,
      { timeout: CHROME_TIMEOUT },
    );

    await manager.focus('[data-theme-choice="system"]');
    await manager.keyboard.press('ArrowRight');
    await manager.waitForFunction(() => document.documentElement.dataset.theme === 'dark', {
      timeout: CHROME_TIMEOUT,
    });
    assert.equal(
      await manager.$eval(
        '[data-theme-choice="dark"]',
        (input) => input instanceof HTMLInputElement && input.checked,
      ),
      true,
    );

    await clickWhenReady(manager, '[data-remove]');
    const confirmation = await manager.$eval('[data-remove]', (button) => {
      if (!(button instanceof HTMLButtonElement))
        throw new Error('remove control is not a button');
      const state = { label: button.getAttribute('aria-label'), text: button.textContent };
      // Inspect and confirm in one browser task so the UI's 3.5-second safety
      // window cannot expire between separate DevTools round trips.
      button.click();
      return state;
    });
    assert.deepEqual(confirmation, {
      label: 'Confirm removal of blocked.test',
      text: 'Confirm',
    });
    await manager.waitForFunction(
      async () => {
        const stored = (await chrome.storage.local.get<ExtensionStorage>('entries')).entries;
        const rules = await chrome.declarativeNetRequest.getDynamicRules();
        return (
          stored?.version === 1 &&
          stored.entries?.length === 0 &&
          rules.length === 0 &&
          document.activeElement?.id === 'domain'
        );
      },
      { timeout: CHROME_TIMEOUT },
    );

    assert.equal(await manager.evaluate(() => document.activeElement?.id), 'domain');
  } finally {
    await browser?.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve(undefined)));
    });
  }
});

test('the manager repairs damaged storage and concurrent tabs preserve every change', {
  timeout: 60_000,
}, async () => {
  let browser: Browser | undefined;
  try {
    browser = await launchExtension();
    const workerTarget = await browser.waitForTarget(
      (target) => target.type() === 'service_worker' && target.url().endsWith('/background.js'),
      { timeout: CHROME_TIMEOUT },
    );
    const manager = await browser.newPage();
    await manager.evaluateOnNewDocument(() => {
      const original = chrome.storage.local.get.bind(chrome.storage.local) as (
        keys?: StorageGetKeys,
      ) => Promise<StorageItems>;
      let fail = true;
      Reflect.set(chrome.storage.local, 'get', async (keys?: StorageGetKeys) => {
        if (fail) {
          fail = false;
          throw new Error('simulated initial read failure');
        }
        return original(keys);
      });
    });
    await manager.goto(`chrome-extension://${new URL(workerTarget.url()).host}/options.html`);

    await manager.waitForFunction(
      () =>
        !document.querySelector('#retry-storage')?.hasAttribute('hidden') &&
        document.querySelector('#domain')?.hasAttribute('disabled'),
      { timeout: CHROME_TIMEOUT },
    );
    assert.match(
      await manager.$eval('#enforcing', (node) => node.textContent ?? ''),
      /could not be loaded/,
    );

    await clickWhenReady(manager, '#retry-storage');
    await manager.waitForFunction(
      () => !document.querySelector('#domain')?.hasAttribute('disabled'),
      { timeout: CHROME_TIMEOUT },
    );

    await manager.type('#domain', 'stale.example');
    await manager.click('#add-form button[type="submit"]');
    await manager.waitForFunction(
      async () => {
        const stored = (await chrome.storage.local.get<ExtensionStorage>('entries')).entries;
        return (
          stored?.entries.length === 1 &&
          (await chrome.declarativeNetRequest.getDynamicRules()).length === 1
        );
      },
      { timeout: CHROME_TIMEOUT },
    );
    await manager.waitForFunction(
      () =>
        !document.querySelector('#add-form button')?.hasAttribute('disabled') &&
        document.querySelector('#enforcing')?.textContent?.includes('enforcing 1'),
      { timeout: CHROME_TIMEOUT },
    );

    // A damaged or future-version envelope must not leave an uneditable list
    // while Chrome silently keeps enforcing the old rule.
    await manager.evaluate(async () => {
      await chrome.storage.local.set({ entries: { version: 999, entries: [] } });
    });
    await manager.waitForFunction(
      () =>
        !document.querySelector('#reset-storage')?.hasAttribute('hidden') &&
        document.querySelector('#domain')?.hasAttribute('disabled'),
      { timeout: CHROME_TIMEOUT },
    );
    assert.match(
      await manager.$eval('#enforcing', (node) => node.textContent ?? ''),
      /damaged/,
    );

    await clickWhenReady(manager, '#reset-storage');
    assert.equal(
      await manager.$eval('#reset-storage', (button) => button.textContent),
      'Confirm reset',
    );
    await clickWhenReady(manager, '#reset-storage');
    await manager.waitForFunction(
      async () => {
        const stored = (await chrome.storage.local.get<ExtensionStorage>('entries')).entries;
        return (
          stored?.version === 1 &&
          stored.entries.length === 0 &&
          (await chrome.declarativeNetRequest.getDynamicRules()).length === 0 &&
          !document.querySelector('#domain')?.hasAttribute('disabled')
        );
      },
      { timeout: CHROME_TIMEOUT },
    );

    const secondManager = await browser.newPage();
    await secondManager.goto(
      `chrome-extension://${new URL(workerTarget.url()).host}/options.html`,
    );
    await secondManager.waitForFunction(
      () => !document.querySelector('#domain')?.hasAttribute('disabled'),
      { timeout: CHROME_TIMEOUT },
    );

    await Promise.all([
      manager.type('#domain', 'example.com'),
      secondManager.type('#domain', 'example.org'),
    ]);
    await Promise.all([
      manager.$eval('#add-form', (node) => {
        if (!(node instanceof HTMLFormElement)) throw new Error('add form is missing');
        node.requestSubmit();
      }),
      secondManager.$eval('#add-form', (node) => {
        if (!(node instanceof HTMLFormElement)) throw new Error('add form is missing');
        node.requestSubmit();
      }),
    ]);

    const isSubmitDisabled = (page: Page) =>
      page.$eval('#add-form button', (button) =>
        button instanceof HTMLButtonElement ? button.disabled : null,
      );
    await Promise.all([
      expect.poll(() => isSubmitDisabled(manager), { timeout: CHROME_TIMEOUT }).toBe(false),
      expect
        .poll(() => isSubmitDisabled(secondManager), { timeout: CHROME_TIMEOUT })
        .toBe(false),
    ]);

    const finalState = await manager.evaluate(async () => {
      const stored = (await chrome.storage.local.get<ExtensionStorage>('entries')).entries;
      return {
        domains: stored?.entries.map(({ domain }) => domain).sort(),
        rules: (await chrome.declarativeNetRequest.getDynamicRules()).length,
      };
    });
    assert.deepEqual(finalState.domains, ['example.com', 'example.org']);
    assert.equal(finalState.rules, 2);
  } finally {
    await browser?.close();
  }
});
