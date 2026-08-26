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

test('subframes are ignored and a successful page change prevents an error retry', async () => {
  let reads = 0;
  const redirects: string[] = [];
  let guard: ReturnType<typeof createNavigationGuard>;
  guard = createNavigationGuard({
    isBlocked: async () => {
      reads++;
      return true;
    },
    showBlockedPage: async (_tabId, host) => {
      redirects.push(host);
      await guard.begin(navigation('chrome-extension://example/blocked.html'));
    },
  });

  await guard.begin(navigation('https://youtube.com/embed', 2));
  await guard.begin(navigation('chrome-extension://example/options.html'));
  const current = navigation('https://youtube.com/');
  await Promise.all([
    guard.begin(current),
    guard.checkError(current),
    guard.checkError(current),
  ]);

  assert.equal(reads, 1);
  assert.deepEqual(redirects, ['youtube.com']);
});

test('an error retries after an earlier custom-page navigation was lost', async () => {
  let releaseFirstAttempt: () => void = () => undefined;
  let firstAttemptReady: () => void = () => undefined;
  const holdFirstAttempt = new Promise<void>((resolve) => {
    releaseFirstAttempt = resolve;
  });
  const firstAttemptStarted = new Promise<void>((resolve) => {
    firstAttemptReady = resolve;
  });
  let reads = 0;
  const redirects: string[] = [];
  const guard = createNavigationGuard({
    isBlocked: async () => {
      reads++;
      return true;
    },
    showBlockedPage: async (_tabId, host) => {
      redirects.push(host);
      if (redirects.length === 1) {
        firstAttemptReady();
        await holdFirstAttempt;
      }
    },
  });

  const current = navigation('https://youtube.com/watch?v=private');
  const initial = guard.begin(current);
  await firstAttemptStarted;
  const errors = Promise.all([guard.checkError(current), guard.checkError(current)]);
  releaseFirstAttempt();
  await Promise.all([initial, errors]);

  assert.equal(reads, 2);
  assert.deepEqual(redirects, ['youtube.com', 'youtube.com']);
});

test('an error without current navigation state cannot redirect the tab', async () => {
  const redirects: string[] = [];
  const guard = createNavigationGuard({
    isBlocked: async () => true,
    showBlockedPage: async (_tabId, host) => redirects.push(host),
  });

  await guard.checkError(navigation('https://youtube.com/watch?v=private'));

  assert.deepEqual(redirects, []);
});
