import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

import { blockedPageUrl } from '../lib/blocked-page';
import { type Entry, findBlockerForHost, rulesBlockHost } from '../lib/domains';
import { createNavigationGuard } from '../lib/navigation-guard';
import {
  type EntryMutation,
  isSyncRequest,
  type MutationErrorCode,
  type MutationResponse,
  mutationFailure,
  mutationSuccess,
  parseMutationRequest,
  type RuleErrorCode,
  syncFailure,
  syncSuccess,
} from '../lib/protocol';
import {
  ENTRIES_KEY,
  entriesFromStorage,
  mutateEntries,
  RuleCapacityError,
  readEntries,
  StoredEntriesError,
  syncRules,
} from '../lib/store';

/**
 * Blocking has two layers. declarativeNetRequest handles requests at the
 * network boundary, including while the worker sleeps. webNavigation catches
 * navigations a site's own service worker serves from CacheStorage before they
 * reach that boundary.
 */
export default defineBackground(() => {
  let cachedEntries: Promise<Entry[]> | undefined;
  let mutationQueue = Promise.resolve();
  let ruleSyncQueue = Promise.resolve();

  function entriesForNavigation(): Promise<Entry[]> {
    cachedEntries ??= readEntries().catch((error: unknown) => {
      cachedEntries = undefined;
      throw error;
    });
    return cachedEntries;
  }

  function scheduleRuleSync(): Promise<void> {
    const operation = ruleSyncQueue.then(syncRules);
    ruleSyncQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  function scheduleMutation(mutation: EntryMutation): Promise<Entry[]> {
    const operation = mutationQueue.then(() => mutateEntries(mutation));
    mutationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  function syncInBackground(): void {
    void scheduleRuleSync().catch((error: unknown) =>
      console.error('Could not update block rules.', error),
    );
  }

  const navigationGuard = createNavigationGuard({
    isBlocked: async (host) => {
      try {
        return findBlockerForHost(host, await entriesForNavigation()) !== null;
      } catch (error) {
        // DNR cannot intercept a response supplied by a site's service worker.
        // When storage is unavailable, preserve the last-known enforced state
        // instead of allowing a CacheStorage response through by default.
        console.error('Could not read the blocklist for navigation.', error);
        return rulesBlockHost(await browser.declarativeNetRequest.getDynamicRules(), host);
      }
    },
    showBlockedPage: (tabId, host) => browser.tabs.update(tabId, { url: blockedPageUrl(host) }),
  });

  // MV3 workers are terminated between events, so every listener is registered
  // synchronously. The cache is only a performance aid; storage is authoritative.
  browser.runtime.onInstalled.addListener(syncInBackground);
  browser.runtime.onStartup.addListener(syncInBackground);

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const changed = changes[ENTRIES_KEY];
    if (!changed) return;
    try {
      cachedEntries = Promise.resolve(entriesFromStorage(changed.newValue));
    } catch (error) {
      cachedEntries = undefined;
      console.error('Could not read the updated blocklist.', error);
      return;
    }
    syncInBackground();
  });

  browser.action.onClicked.addListener(() => void browser.runtime.openOptionsPage());

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isTrustedSender(sender)) return false;

    const mutationRequest = parseMutationRequest(message);
    if (mutationRequest) {
      void handleMutation(mutationRequest.mutation).then(sendResponse);
      return true;
    }

    if (!isSyncRequest(message)) return false;

    void scheduleRuleSync().then(
      () => sendResponse(syncSuccess()),
      (error: unknown) => sendResponse(syncFailure(ruleErrorCode(error))),
    );
    // Callback responses are supported by the declared Chrome 123 floor.
    return true;
  });

  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    runNavigationCheck(navigationGuard.begin(details));
  });
  browser.webNavigation.onErrorOccurred.addListener((details) => {
    if (details.error !== 'net::ERR_BLOCKED_BY_CLIENT') return;
    runNavigationCheck(navigationGuard.checkError(details));
  });
  browser.tabs.onRemoved.addListener((tabId) => navigationGuard.forget(tabId));

  function isTrustedSender(sender: Browser.runtime.MessageSender): boolean {
    return (
      sender.id === browser.runtime.id &&
      typeof sender.url === 'string' &&
      sender.url.startsWith(browser.runtime.getURL(''))
    );
  }

  function ruleErrorCode(error: unknown): RuleErrorCode {
    return error instanceof RuleCapacityError ? error.code : 'rule-update';
  }

  function mutationErrorCode(error: unknown): MutationErrorCode {
    return error instanceof StoredEntriesError ? 'stored-entries' : 'storage-update';
  }

  async function handleMutation(mutation: EntryMutation): Promise<MutationResponse> {
    let entries: Entry[];
    try {
      entries = await scheduleMutation(mutation);
    } catch (error) {
      return mutationFailure(mutationErrorCode(error));
    }

    cachedEntries = Promise.resolve(entries);
    try {
      await scheduleRuleSync();
      return mutationSuccess();
    } catch (error) {
      return mutationSuccess(ruleErrorCode(error));
    }
  }

  function runNavigationCheck(check: Promise<void>): void {
    void check.catch((error: unknown) => console.error('Could not check navigation.', error));
  }
});
