import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

import type { Entry } from '../extension/lib/domains';
import {
  applyEntryMutation,
  ENTRIES_KEY,
  ENTRIES_VERSION,
  entriesFromStorage,
  mutateEntries,
  newEntry,
  RuleCapacityError,
  readEntries,
  rulesMatch,
  StoredEntriesError,
  syncRules,
  writeEntries,
} from '../extension/lib/store';
import { installFakeBrowser, uninstallFakeBrowser } from './support/fake-browser';

const entry = (domain: string, enabled = true, includeSubdomains = true): Entry => ({
  id: domain,
  domain,
  includeSubdomains,
  enabled,
});

const stored = (entries: Entry[]) => ({ version: ENTRIES_VERSION, entries });

afterEach(uninstallFakeBrowser);

test('readEntries treats a missing blocklist as empty', async () => {
  installFakeBrowser();
  assert.deepEqual(await readEntries(), []);
});

test('readEntries discards the pre-release bare array instead of migrating it', async () => {
  const state = installFakeBrowser({ entries: [entry('old.example')] });
  assert.deepEqual(await readEntries(), []);
  assert.equal(ENTRIES_KEY in state.storage, false);
});

test('readEntries rejects unknown and damaged storage', async () => {
  installFakeBrowser({ entries: 'not an array' });
  await assert.rejects(readEntries(), StoredEntriesError);

  installFakeBrowser({ entries: { version: 2, entries: [] } });
  await assert.rejects(readEntries(), StoredEntriesError);

  installFakeBrowser({
    entries: { version: ENTRIES_VERSION, entries: [{ domain: 'half.com' }] },
  });
  await assert.rejects(readEntries(), StoredEntriesError);
});

test('writeEntries and readEntries round trip', async () => {
  const state = installFakeBrowser();
  await writeEntries([entry('youtube.com')]);
  assert.deepEqual(state.storage[ENTRIES_KEY], stored([entry('youtube.com')]));
  assert.deepEqual(await readEntries(), [entry('youtube.com')]);
});

test('entriesFromStorage removes legacy fields inside the current envelope', () => {
  const good = entry('youtube.com');
  assert.deepEqual(
    entriesFromStorage({ version: ENTRIES_VERSION, entries: [{ ...good, createdAt: 0 }] }),
    [good],
  );
});

test('newEntry starts switched on and carries the chosen scope', () => {
  installFakeBrowser();
  const created = newEntry('youtube.com', false);
  assert.equal(created.domain, 'youtube.com');
  assert.equal(created.includeSubdomains, false);
  assert.equal(created.enabled, true);
  assert.match(created.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(created).sort(), [
    'domain',
    'enabled',
    'id',
    'includeSubdomains',
  ]);
});

test('small mutations preserve changes made from another manager view', async () => {
  installFakeBrowser();
  const first = entry('first.example');
  const second = entry('second.example');

  await mutateEntries({ type: 'add', entry: first });
  await mutateEntries({ type: 'add', entry: second });
  await mutateEntries({ type: 'set-enabled', id: first.id, enabled: false });

  assert.deepEqual(await readEntries(), [second, { ...first, enabled: false }]);
});

test('duplicate and missing-entry mutations are harmless no-ops', () => {
  const current = [entry('youtube.com')];
  assert.equal(
    applyEntryMutation(current, { type: 'add', entry: current[0] as Entry }),
    current,
  );
  assert.equal(applyEntryMutation(current, { type: 'remove', id: 'missing' }), current);
  assert.equal(
    applyEntryMutation(current, {
      type: 'set-enabled',
      id: current[0]?.id ?? '',
      enabled: true,
    }),
    current,
  );
});

test('reset repairs damaged storage without trying to parse it first', async () => {
  const state = installFakeBrowser({ entries: { version: 999, entries: 'damaged' } });
  await mutateEntries({ type: 'reset' });

  assert.deepEqual(state.storage[ENTRIES_KEY], stored([]));
  assert.deepEqual(await readEntries(), []);
});

test('syncRules hands Chrome one rule per active entry', async () => {
  const state = installFakeBrowser({
    entries: stored([entry('youtube.com'), entry('paused.com', false)]),
  });
  await syncRules();

  assert.equal(state.rules.length, 1);
  assert.deepEqual(state.rules[0]?.condition.requestDomains, ['youtube.com']);
  assert.equal(state.rules[0]?.action.type, 'block');
});

test('syncRules does nothing when Chrome already agrees', async () => {
  const state = installFakeBrowser({ entries: stored([entry('youtube.com')]) });
  await syncRules();
  assert.equal(state.updateCalls, 1);

  await syncRules();
  assert.equal(state.updateCalls, 1, 'a matching rule set must not be rewritten');
});

test('syncRules clears rules for entries that are gone', async () => {
  const state = installFakeBrowser({ entries: stored([entry('youtube.com')]) });
  await syncRules();
  assert.equal(state.rules.length, 1);

  state.storage[ENTRIES_KEY] = stored([]);
  await syncRules();
  assert.deepEqual(state.rules, [], 'stale rules are removed');
});

test('syncRules retries once when another context wins the race', async () => {
  const state = installFakeBrowser({
    entries: stored([entry('youtube.com')]),
    failUpdates: 1,
  });
  await syncRules();

  assert.equal(state.updateCalls, 2, 'the failed write is retried');
  assert.equal(state.rules.length, 1, 'and the rules end up correct');
});

test('a retry rebuilds its desired rules from fresh storage', async () => {
  const state = installFakeBrowser({
    entries: stored([entry('old.example')]),
    failUpdates: 1,
    onFailedUpdate: (failedState) => {
      failedState.storage[ENTRIES_KEY] = stored([entry('new.example')]);
    },
  });
  await syncRules();

  assert.deepEqual(state.rules[0]?.condition.requestDomains, ['new.example']);
});

test('syncRules gives up if the retry also fails', async () => {
  installFakeBrowser({ entries: stored([entry('youtube.com')]), failUpdates: 2 });
  await assert.rejects(syncRules(), /simulated race/);
});

test('syncRules reports Chrome rule quotas before attempting an invalid update', async () => {
  const state = installFakeBrowser({
    entries: stored([entry('one.example', true, false), entry('two.example', true, false)]),
    maxRegexRules: 1,
  });

  await assert.rejects(
    syncRules(),
    (error) =>
      error instanceof RuleCapacityError &&
      error.code === 'regex-rule-limit' &&
      /at most 1 narrow domain rule/.test(error.message),
  );
  assert.equal(state.updateCalls, 0);
});

test('rulesMatch compares rule content instead of counts', async () => {
  const state = installFakeBrowser({ entries: stored([entry('youtube.com')]) });
  await syncRules();
  const expected = structuredClone(state.rules);
  const wrong = structuredClone(state.rules);
  const [wrongRule] = wrong;
  assert.ok(wrongRule);
  wrongRule.condition.requestDomains = ['reddit.com'];

  assert.equal(rulesMatch(state.rules, expected), true);
  assert.equal(rulesMatch(wrong, expected), false);
});
