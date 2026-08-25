import assert from 'node:assert/strict';
import { test } from 'vitest';
import { browser } from 'wxt/browser';

import { blockedHostFrom, blockedPageUrl } from '../extension/lib/blocked-page';

const BASE = browser.runtime.getURL('/');

test('a blocked hostname survives the trip to the page and back', () => {
  for (const host of ['www.youtube.com', 'example.com', 'xn--mnchen-3ya.de']) {
    const page = new URL(blockedPageUrl(host));
    assert.equal(blockedHostFrom(page.search), host, `round trip failed for ${host}`);
  }
});

test('the blocked page address never carries a path, query, fragment, or credentials', () => {
  const page = new URL(blockedPageUrl('youtube.com'));
  assert.equal(page.search, '?host=youtube.com');
  assert.ok(!page.href.includes('watch'));

  for (const tampered of [
    '?host=youtube.com/watch?v=private',
    '?host=user@example.com',
    '?host=example.com:8443',
    '?host=%5B::1%5D',
    '?host=youtube.com%5Cprivate',
  ]) {
    assert.equal(blockedHostFrom(tampered), '');
  }
});

test('the blocked page lives inside the extension', () => {
  const page = new URL(blockedPageUrl('youtube.com'));
  assert.equal(page.origin, new URL(BASE).origin);
  assert.equal(page.pathname, '/blocked.html');
});

test('a missing or empty parameter reads as no host', () => {
  assert.equal(blockedHostFrom(''), '');
  assert.equal(blockedHostFrom('?other=1'), '');
});
