import { hostOf } from './domains';

export interface Navigation {
  tabId: number;
  frameId: number;
  url: string;
}

interface NavigationCheck {
  tabId: number;
  host: string;
}

interface GuardDependencies {
  isBlocked: (host: string) => Promise<boolean>;
  showBlockedPage: (tabId: number, host: string) => Promise<unknown>;
}

/**
 * Sequences top-level navigations per tab so a slow storage read for navigation
 * A cannot redirect navigation B. Only the hostname survives synchronously;
 * paths, queries, fragments, and credentials are never retained across a wait.
 */
export function createNavigationGuard({ isBlocked, showBlockedPage }: GuardDependencies) {
  const current = new Map<number, { sequence: number; host: string | null }>();
  const pending = new Map<string, Promise<void>>();
  const pendingErrors = new Map<string, Promise<void>>();

  function begin(navigation: Navigation): Promise<void> {
    if (!isTopLevel(navigation)) return Promise.resolve();
    const sequence = (current.get(navigation.tabId)?.sequence ?? 0) + 1;
    const host = hostOf(navigation.url);
    current.set(navigation.tabId, { sequence, host });
    return host ? check({ tabId: navigation.tabId, host }, sequence) : Promise.resolve();
  }

  function check(navigation: NavigationCheck, sequence: number): Promise<void> {
    const key = `${navigation.tabId}:${sequence}`;
    const active = pending.get(key);
    if (active) return active;

    const task = guard(navigation, sequence).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }

  /**
   * Retries after Chrome has established its error document. A custom-page
   * update made during onBeforeNavigate can lose to the original navigation in
   * a newly created tab. Duplicate error events share the same retry.
   */
  function checkError(navigation: Navigation): Promise<void> {
    if (!isTopLevel(navigation)) return Promise.resolve();
    const host = hostOf(navigation.url);
    const latest = current.get(navigation.tabId);
    if (!host || !latest || latest.host !== host) return Promise.resolve();

    const checkNavigation = { tabId: navigation.tabId, host };
    const key = `${navigation.tabId}:${latest.sequence}`;
    const active = pendingErrors.get(key);
    if (active) return active;

    const task = retryAfterError(checkNavigation, latest.sequence, key).finally(() =>
      pendingErrors.delete(key),
    );
    pendingErrors.set(key, task);
    return task;
  }

  async function retryAfterError(
    navigation: NavigationCheck,
    sequence: number,
    key: string,
  ): Promise<void> {
    try {
      await pending.get(key);
    } catch {
      // Give the post-error attempt its own chance after an earlier check failed.
    }
    if (!isCurrent(navigation, sequence)) return;
    await check(navigation, sequence);
  }

  async function guard(navigation: NavigationCheck, sequence: number): Promise<void> {
    if (!(await isBlocked(navigation.host)) || !isCurrent(navigation, sequence)) return;

    try {
      await showBlockedPage(navigation.tabId, navigation.host);
    } catch {
      // The tab closed or navigated again after the final current-document check.
    }
  }

  function isCurrent(navigation: NavigationCheck, sequence: number): boolean {
    const latest = current.get(navigation.tabId);
    return latest?.sequence === sequence && latest.host === navigation.host;
  }

  function isTopLevel(navigation: Navigation): boolean {
    return navigation.frameId === 0 && navigation.tabId >= 0;
  }

  return {
    begin,
    checkError,
    forget: (tabId: number): boolean => current.delete(tabId),
  };
}
