import { type Entry, toEntries } from './domains';

export const MESSAGE_VERSION = 1 as const;

export type RuleErrorCode = 'dynamic-rule-limit' | 'regex-rule-limit' | 'rule-update';
export type MutationErrorCode = 'stored-entries' | 'storage-update';

export interface SyncRequest {
  version: typeof MESSAGE_VERSION;
  type: 'sync-rules';
}
export type SyncResponse =
  | { version: typeof MESSAGE_VERSION; ok: true }
  | { version: typeof MESSAGE_VERSION; ok: false; error: RuleErrorCode };

export type EntryMutation =
  | { type: 'add'; entry: Entry }
  | { type: 'set-enabled'; id: string; enabled: boolean }
  | { type: 'set-subdomains'; id: string; includeSubdomains: boolean }
  | { type: 'remove'; id: string }
  | { type: 'reset' };

export interface MutationRequest {
  version: typeof MESSAGE_VERSION;
  type: 'mutate-entries';
  mutation: EntryMutation;
}

export type MutationResponse =
  | {
      version: typeof MESSAGE_VERSION;
      ok: true;
      ruleError: RuleErrorCode | null;
    }
  | { version: typeof MESSAGE_VERSION; ok: false; error: MutationErrorCode };

export function syncRequest(): SyncRequest {
  return { version: MESSAGE_VERSION, type: 'sync-rules' };
}

export function isSyncRequest(value: unknown): value is SyncRequest {
  if (typeof value !== 'object' || value === null) return false;
  const request = value as Record<string, unknown>;
  return request.version === MESSAGE_VERSION && request.type === 'sync-rules';
}

export function syncSuccess(): SyncResponse {
  return { version: MESSAGE_VERSION, ok: true };
}

export function syncFailure(error: RuleErrorCode): SyncResponse {
  return { version: MESSAGE_VERSION, ok: false, error };
}

export function parseSyncResponse(value: unknown): SyncResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const response = value as Record<string, unknown>;
  if (response.version !== MESSAGE_VERSION) return null;
  if (response.ok === true) return syncSuccess();
  if (response.ok !== false || !isRuleErrorCode(response.error)) return null;
  return syncFailure(response.error);
}

export function mutationRequest(mutation: EntryMutation): MutationRequest {
  return { version: MESSAGE_VERSION, type: 'mutate-entries', mutation };
}

export function parseMutationRequest(value: unknown): MutationRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const request = value as Record<string, unknown>;
  if (request.version !== MESSAGE_VERSION || request.type !== 'mutate-entries') return null;

  const mutation = parseMutation(request.mutation);
  return mutation ? mutationRequest(mutation) : null;
}

export function mutationSuccess(ruleError: RuleErrorCode | null = null): MutationResponse {
  return { version: MESSAGE_VERSION, ok: true, ruleError };
}

export function mutationFailure(error: MutationErrorCode): MutationResponse {
  return { version: MESSAGE_VERSION, ok: false, error };
}

export function parseMutationResponse(value: unknown): MutationResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const response = value as Record<string, unknown>;
  if (response.version !== MESSAGE_VERSION) return null;
  if (response.ok === false && isMutationErrorCode(response.error)) {
    return mutationFailure(response.error);
  }
  if (
    response.ok !== true ||
    (response.ruleError !== null && !isRuleErrorCode(response.ruleError))
  ) {
    return null;
  }
  return mutationSuccess(response.ruleError);
}

function parseMutation(value: unknown): EntryMutation | null {
  if (typeof value !== 'object' || value === null) return null;
  const mutation = value as Record<string, unknown>;

  if (mutation.type === 'reset') return { type: 'reset' };
  if (mutation.type === 'add') {
    const entries = toEntries([mutation.entry]);
    return entries.length === 1 && entries[0] ? { type: 'add', entry: entries[0] } : null;
  }
  const id = mutation.id;
  if (typeof id !== 'string' || !id) return null;

  if (mutation.type === 'remove') return { type: 'remove', id };
  if (mutation.type === 'set-enabled' && typeof mutation.enabled === 'boolean') {
    return { type: 'set-enabled', id, enabled: mutation.enabled };
  }
  if (mutation.type === 'set-subdomains' && typeof mutation.includeSubdomains === 'boolean') {
    return {
      type: 'set-subdomains',
      id,
      includeSubdomains: mutation.includeSubdomains,
    };
  }
  return null;
}

function isRuleErrorCode(value: unknown): value is RuleErrorCode {
  return (
    value === 'dynamic-rule-limit' || value === 'regex-rule-limit' || value === 'rule-update'
  );
}

function isMutationErrorCode(value: unknown): value is MutationErrorCode {
  return value === 'stored-entries' || value === 'storage-update';
}
