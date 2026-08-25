import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  isSyncRequest,
  mutationFailure,
  mutationRequest,
  mutationSuccess,
  parseMutationRequest,
  parseMutationResponse,
  parseSyncResponse,
  syncFailure,
  syncRequest,
  syncSuccess,
} from '../extension/lib/protocol';

const entry = {
  id: 'youtube',
  domain: 'youtube.com',
  includeSubdomains: true,
  enabled: true,
};

test('the rule-sync protocol is versioned and rejects unknown messages', () => {
  assert.equal(isSyncRequest(syncRequest()), true);
  assert.equal(isSyncRequest({ type: 'sync-rules' }), false);
  assert.equal(isSyncRequest({ version: 2, type: 'sync-rules' }), false);
});

test('the rule-sync protocol validates both response variants', () => {
  assert.deepEqual(parseSyncResponse(syncSuccess()), syncSuccess());
  assert.deepEqual(
    parseSyncResponse(syncFailure('regex-rule-limit')),
    syncFailure('regex-rule-limit'),
  );
  assert.equal(
    parseSyncResponse({ version: 1, ok: false, error: 'private stack trace' }),
    null,
  );
  assert.equal(parseSyncResponse(undefined), null);
});

test('the mutation protocol validates every supported intent', () => {
  for (const mutation of [
    { type: 'add', entry },
    { type: 'set-enabled', id: entry.id, enabled: false },
    { type: 'set-subdomains', id: entry.id, includeSubdomains: false },
    { type: 'remove', id: entry.id },
    { type: 'reset' },
  ] as const) {
    const request = mutationRequest(mutation);
    assert.deepEqual(parseMutationRequest(request), request);
  }

  assert.equal(parseMutationRequest({ version: 1, type: 'mutate-entries' }), null);
  assert.equal(
    parseMutationRequest({
      version: 1,
      type: 'mutate-entries',
      mutation: { type: 'set-enabled', id: entry.id, enabled: 'yes' },
    }),
    null,
  );
});

test('the mutation protocol validates both response variants', () => {
  assert.deepEqual(parseMutationResponse(mutationSuccess()), mutationSuccess());
  assert.deepEqual(
    parseMutationResponse(mutationFailure('stored-entries')),
    mutationFailure('stored-entries'),
  );
  assert.deepEqual(
    parseMutationResponse(mutationSuccess('dynamic-rule-limit')),
    mutationSuccess('dynamic-rule-limit'),
  );
  assert.equal(
    parseMutationResponse({ version: 1, ok: false, error: 'private stack trace' }),
    null,
  );
});
