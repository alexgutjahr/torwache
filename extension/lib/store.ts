import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';

import { buildRules, type Entry, toEntries } from './domains';
import type { EntryMutation, RuleErrorCode } from './protocol';

export const ENTRIES_KEY = 'entries';
export const ENTRIES_VERSION = 1 as const;
const RULE_UPDATE_ATTEMPTS = 2;
const CHROME_DEFAULT_RULE_PRIORITY = 1;
const FALLBACK_RULE_LIMITS = {
  dynamic: 30_000,
  regex: 1_000,
} as const;

interface StoredEntries {
  version: typeof ENTRIES_VERSION;
  entries: readonly Entry[];
}

type CapacityErrorCode = Exclude<RuleErrorCode, 'rule-update'>;

export class StoredEntriesError extends Error {
  constructor() {
    super('The stored blocklist has an unsupported or damaged format.');
    this.name = 'StoredEntriesError';
  }
}

export class RuleCapacityError extends Error {
  constructor(
    readonly code: CapacityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RuleCapacityError';
  }
}

export async function readEntries(): Promise<Entry[]> {
  const stored = await browser.storage.local.get(ENTRIES_KEY);
  const value = stored[ENTRIES_KEY];

  // Pre-release builds stored a bare array. There are no released users to
  // migrate, so discard that development-only shape instead.
  if (Array.isArray(value)) {
    await browser.storage.local.remove(ENTRIES_KEY);
    return [];
  }

  return entriesFromStorage(value);
}

export async function writeEntries(entries: readonly Entry[]): Promise<void> {
  const value: StoredEntries = { version: ENTRIES_VERSION, entries };
  await browser.storage.local.set({ [ENTRIES_KEY]: value });
}

export function entriesFromStorage(value: unknown): Entry[] {
  if (value === undefined) return [];

  if (typeof value === 'object' && value !== null) {
    const stored = value as Record<string, unknown>;
    if (stored.version === ENTRIES_VERSION && Array.isArray(stored.entries)) {
      const entries = toEntries(stored.entries);
      if (entries.length === stored.entries.length) return entries;
    }
  }

  throw new StoredEntriesError();
}

export function newEntry(domain: string, includeSubdomains: boolean): Entry {
  return {
    id: crypto.randomUUID(),
    domain,
    includeSubdomains,
    enabled: true,
  };
}

/**
 * Applies one intent to the latest stored list. Keeping mutations small avoids
 * one manager tab overwriting changes made by another tab from an older view.
 */
export function applyEntryMutation(
  current: readonly Entry[],
  mutation: EntryMutation,
): readonly Entry[] {
  switch (mutation.type) {
    case 'add':
      return current.some(
        (entry) => entry.id === mutation.entry.id || entry.domain === mutation.entry.domain,
      )
        ? current
        : [mutation.entry, ...current];
    case 'set-enabled':
      return updateEntry(current, mutation.id, (entry) =>
        entry.enabled === mutation.enabled ? entry : { ...entry, enabled: mutation.enabled },
      );
    case 'set-subdomains':
      return updateEntry(current, mutation.id, (entry) =>
        entry.includeSubdomains === mutation.includeSubdomains
          ? entry
          : { ...entry, includeSubdomains: mutation.includeSubdomains },
      );
    case 'remove': {
      const next = current.filter((entry) => entry.id !== mutation.id);
      return next.length === current.length ? current : next;
    }
    case 'reset':
      return [];
  }
}

/** Writes a mutation against fresh storage; reset also repairs damaged storage. */
export async function mutateEntries(mutation: EntryMutation): Promise<Entry[]> {
  if (mutation.type === 'reset') {
    await writeEntries([]);
    return [];
  }

  const current = await readEntries();
  const next = applyEntryMutation(current, mutation);
  if (next !== current) await writeEntries(next);
  return [...next];
}

function updateEntry(
  current: readonly Entry[],
  id: string,
  update: (entry: Entry) => Entry,
): readonly Entry[] {
  const index = current.findIndex((entry) => entry.id === id);
  if (index < 0) return current;
  const updated = update(current[index] as Entry);
  if (updated === current[index]) return current;

  const next = [...current];
  next[index] = updated;
  return next;
}

/**
 * Replaces the whole dynamic ruleset atomically. A failed write is retried from
 * fresh storage, so a retry cannot restore an older list.
 */
export async function syncRules(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < RULE_UPDATE_ATTEMPTS; attempt++) {
    const desired = buildRules(await readEntries());
    assertRuleCapacity(desired);
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    if (rulesMatch(existing, desired)) return;

    try {
      await replace(existing, desired);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Chrome did not update the dynamic ruleset.');
}

/** Compares exact torwache-owned content, not merely the number of rules. */
export function rulesMatch(
  actual: readonly Browser.declarativeNetRequest.Rule[],
  expected: readonly Browser.declarativeNetRequest.Rule[],
): boolean {
  return signature(actual) === signature(expected);
}

/** Ignores defaults Chrome adds when rules are read back. */
function signature(rules: readonly Browser.declarativeNetRequest.Rule[]): string {
  return JSON.stringify(
    [...rules]
      .sort((a, b) => a.id - b.id)
      .map((rule) => [
        rule.id,
        rule.priority ?? CHROME_DEFAULT_RULE_PRIORITY,
        rule.action.type,
        rule.condition.requestDomains ?? null,
        rule.condition.regexFilter ?? null,
        rule.condition.resourceTypes ?? null,
      ]),
  );
}

function assertRuleCapacity(rules: readonly Browser.declarativeNetRequest.Rule[]): void {
  const dnr = browser.declarativeNetRequest;
  const dynamicLimit = dnr.MAX_NUMBER_OF_DYNAMIC_RULES ?? FALLBACK_RULE_LIMITS.dynamic;
  const regexLimit = dnr.MAX_NUMBER_OF_REGEX_RULES ?? FALLBACK_RULE_LIMITS.regex;
  const regexCount = rules.filter((rule) => rule.condition.regexFilter !== undefined).length;

  if (rules.length > dynamicLimit) {
    throw new RuleCapacityError(
      'dynamic-rule-limit',
      `Chrome allows at most ${dynamicLimit} dynamic block rules.`,
    );
  }
  if (regexCount > regexLimit) {
    throw new RuleCapacityError(
      'regex-rule-limit',
      `Chrome allows at most ${regexLimit} narrow domain rules. Enable subdomains or remove entries.`,
    );
  }
}

async function replace(
  existing: readonly Browser.declarativeNetRequest.Rule[],
  desired: readonly Browser.declarativeNetRequest.Rule[],
): Promise<void> {
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: [...desired],
  });
}
