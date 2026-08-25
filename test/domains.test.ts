import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildRules,
  describeScope,
  type Entry,
  entryCovers,
  findBlocker,
  hostOf,
  normalizeDomain,
  rulesBlockHost,
  toEntries,
} from '../extension/lib/domains';

const entry = (domain: string, includeSubdomains = true, enabled = true): Entry => ({
  id: domain,
  domain,
  includeSubdomains,
  enabled,
});

test('normalizeDomain strips everything that is not the host', () => {
  const cases = {
    'youtube.com': 'youtube.com',
    '  YouTube.COM  ': 'youtube.com',
    'https://www.youtube.com/watch?v=abc#t=1': 'youtube.com',
    'http://youtube.com/': 'youtube.com',
    '//youtube.com': 'youtube.com',
    'youtube.com:8080': 'youtube.com',
    'user:pw@youtube.com': 'youtube.com',
    'youtube.com.': 'youtube.com',
    'news.ycombinator.com': 'news.ycombinator.com',
    '1.2.3.4': '1.2.3.4',
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.deepEqual(normalizeDomain(input), { domain: expected }, `for ${input}`);
  }
});

test('normalizeDomain drops a leading www, but never the whole domain', () => {
  assert.deepEqual(normalizeDomain('www.youtube.com'), { domain: 'youtube.com' });
  assert.deepEqual(normalizeDomain('WWW.YouTube.com/feed'), { domain: 'youtube.com' });
  // only when something sensible is left
  assert.deepEqual(normalizeDomain('www.com'), { domain: 'www.com' });
  // and only the leading label
  assert.deepEqual(normalizeDomain('a.www.example.com'), { domain: 'a.www.example.com' });
});

test('normalizeDomain converts internationalised names to punycode', () => {
  assert.deepEqual(normalizeDomain('münchen.de'), { domain: 'xn--mnchen-3ya.de' });
});

test('normalizeDomain rejects input that is not a domain', () => {
  for (const bad of ['', '   ', 'youtube', 'you tube.com', '...', 'a..b', '-x.com', 'x-.com']) {
    assert.ok('error' in normalizeDomain(bad), `expected "${bad}" to be rejected`);
  }
});

test('normalizeDomain rejects public and private registry suffixes', () => {
  for (const suffix of ['com', 'co.uk', 'github.io', 'www.github.io']) {
    assert.ok('error' in normalizeDomain(suffix), `expected "${suffix}" to be rejected`);
  }
  assert.deepEqual(normalizeDomain('project.github.io'), { domain: 'project.github.io' });
  assert.deepEqual(normalizeDomain('example.co.uk'), { domain: 'example.co.uk' });
});

test('toEntries drops anything that is not a well formed entry', () => {
  assert.deepEqual(toEntries(undefined), []);
  assert.deepEqual(toEntries('nonsense'), []);
  assert.deepEqual(toEntries([null, 42, {}, { domain: 'youtube.com' }]), []);

  const good = entry('youtube.com');
  assert.deepEqual(toEntries([good, { domain: 'half.com' }]), [good]);
  assert.deepEqual(toEntries([{ ...good, domain: 'YouTube.com' }]), []);
  assert.deepEqual(toEntries([{ ...good, createdAt: 0 }]), [good], 'legacy fields are removed');
});

test('hostOf only accepts http(s)', () => {
  assert.equal(hostOf('https://m.youtube.com/feed'), 'm.youtube.com');
  assert.equal(hostOf('chrome://extensions'), null);
  assert.equal(hostOf('chrome-extension://abc/blocked.html'), null);
  assert.equal(hostOf('about:blank'), null);
  assert.equal(hostOf('not a url'), null);
});

test('subdomain scope matches on label boundaries only', () => {
  const wide = entry('youtube.com', true);
  assert.ok(entryCovers(wide, 'youtube.com'));
  assert.ok(entryCovers(wide, 'm.youtube.com'));
  assert.ok(entryCovers(wide, 'a.b.youtube.com'));
  assert.ok(!entryCovers(wide, 'notyoutube.com'));
  assert.ok(!entryCovers(wide, 'youtube.com.evil.example'));

  const exact = entry('youtube.com', false);
  assert.ok(entryCovers(exact, 'youtube.com'));
  assert.ok(!entryCovers(exact, 'm.youtube.com'));
  // www is the same site, so a narrow entry still covers it
  assert.ok(entryCovers(exact, 'www.youtube.com'));
  assert.ok(!entryCovers(exact, 'www.m.youtube.com'));
});

test('findBlocker ignores deactivated entries', () => {
  const entries = [entry('youtube.com', true, false), entry('reddit.com', true, true)];
  assert.equal(findBlocker('https://m.youtube.com/', entries), null);
  assert.equal(findBlocker('https://old.reddit.com/', entries)?.domain, 'reddit.com');
  assert.equal(findBlocker('https://example.com/', entries), null);
});

test('the extension can never block its own pages, whatever is on the list', () => {
  // Locking someone out of the blocklist would make the list unremovable.
  const entries = [entry('youtube.com', true), entry('google.com', true)];
  for (const url of [
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop/options.html',
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop/blocked.html?host=youtube.com',
    'chrome://extensions',
    'about:blank',
  ]) {
    assert.equal(findBlocker(url, entries), null, `must not block ${url}`);
  }
});

test('an extension id cannot be added as a domain', () => {
  assert.ok('error' in normalizeDomain('abcdefghijklmnopabcdefghijklmnop'));
  assert.ok(
    'error' in
      normalizeDomain('chrome-extension://abcdefghijklmnopabcdefghijklmnop/options.html'),
  );
});

test('describeScope says what an entry covers', () => {
  assert.equal(describeScope(entry('youtube.com', true)), 'youtube.com and its subdomains');
  assert.equal(describeScope(entry('youtube.com', false)), 'youtube.com');
});

test('buildRules emits one blocking rule per active entry, ids from 1', () => {
  const rules = buildRules([
    entry('youtube.com', true),
    entry('paused.com', true, false),
    entry('reddit.com', false),
  ]);

  assert.equal(rules.length, 2);
  assert.deepEqual(
    rules.map((rule) => rule.id),
    [1, 2],
  );
  assert.ok(rules.every((rule) => rule.action.type === 'block'));
  assert.ok(
    rules.every((rule) => {
      const types = rule.condition.resourceTypes ?? [];
      return types.includes('main_frame') && types.includes('sub_frame');
    }),
  );

  assert.deepEqual(rules[0]?.condition.requestDomains, ['youtube.com']);
  assert.equal(rules[1]?.condition.requestDomains, undefined);
});

test('the exact-match rule anchors to the whole host', () => {
  const filter = buildRules([entry('youtube.com', false)])[0]?.condition.regexFilter;
  assert.ok(filter, 'expected a regexFilter');
  const pattern = new RegExp(filter);

  for (const url of [
    'https://youtube.com/',
    'http://youtube.com/watch?v=1',
    'https://youtube.com',
    'https://youtube.com:8443/x',
    'https://youtube.com?q=1',
    'https://www.youtube.com/',
    'https://www.youtube.com/watch?v=1',
  ]) {
    assert.ok(pattern.test(url), `expected to block ${url}`);
  }

  for (const url of [
    'https://m.youtube.com/',
    'https://wwwyoutube.com/',
    'https://www.youtube.com.evil.example/',
    'https://youtube.com.evil.example/',
    'https://notyoutube.com/',
    'https://evil.example/?r=https://youtube.com/',
  ]) {
    assert.ok(!pattern.test(url), `expected NOT to block ${url}`);
  }
});

test('last-known rules can safely answer navigation checks when storage is unavailable', () => {
  const rules = buildRules([entry('youtube.com', true), entry('reddit.com', false)]);

  assert.equal(rulesBlockHost(rules, 'm.youtube.com'), true);
  assert.equal(rulesBlockHost(rules, 'notyoutube.com'), false);
  assert.equal(rulesBlockHost(rules, 'reddit.com'), true);
  assert.equal(rulesBlockHost(rules, 'www.reddit.com'), true);
  assert.equal(rulesBlockHost(rules, 'old.reddit.com'), false);
  assert.equal(rulesBlockHost(rules, 'example.com'), false);
});
