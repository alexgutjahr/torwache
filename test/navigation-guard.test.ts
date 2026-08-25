import assert from 'node:assert/strict';
import { test } from 'vitest';

import { createNavigationGuard, type Navigation } from '../extension/lib/navigation-guard';

const navigation = (url: string, frameId = 0): Navigation => ({ tabId: 7, frameId, url });

test('a slow check cannot redirect a newer allowed navigation', async () => {
  let releaseCheck: () => void = () => undefined;
  const checkReady = new Promise<void>((resolve) => {
    releaseCheck = resolve;
  });
  const redirects: string[] = [];
  const guard = createNavigationGuard({
    isBlocked: async (host) => {
      await checkReady;
      return host.endsWith('youtube.com');
    },
    showBlockedPage: async (_tabId, host) => redirects.push(host),
  });

  const stale = guard.begin(navigation('https://youtube.com/watch?v=private'));
  const current = guard.begin(navigation('https://example.com/'));
  releaseCheck();
  await Promise.all([stale, current]);

  assert.deepEqual(redirects, []);
});

test('the guard passes only the blocked hostname to the page', async () => {
  const redirects: string[] = [];
  const guard = createNavigationGuard({
    isBlocked: async () => true,
    showBlockedPage: async (_tabId, host) => redirects.push(host),
  });

  await guard.begin(navigation('https://m.youtube.com/watch?v=private#history'));
  assert.deepEqual(redirects, ['m.youtube.com']);
});

test('subframes are ignored and duplicate error events share the current check', async () => {
  let reads = 0;
  const redirects: string[] = [];
  const guard = createNavigationGuard({
    isBlocked: async () => {
      reads++;
      return true;
    },
    showBlockedPage: async (_tabId, host) => redirects.push(host),
  });

  await guard.begin(navigation('https://youtube.com/embed', 2));
  await guard.begin(navigation('chrome-extension://example/options.html'));
  const current = navigation('https://youtube.com/');
  await Promise.all([guard.begin(current), guard.checkError(current)]);

  assert.equal(reads, 1);
  assert.deepEqual(redirects, ['youtube.com']);
});
