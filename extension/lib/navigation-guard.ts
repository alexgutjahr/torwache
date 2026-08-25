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

  /** Resolves an error only when its host still belongs to the current navigation. */
  function checkError(navigation: Navigation): Promise<void> {
    if (!isTopLevel(navigation)) return Promise.resolve();
    const host = hostOf(navigation.url);
    const latest = current.get(navigation.tabId);
    if (!host || !latest || latest.host !== host) return Promise.resolve();
    return check({ tabId: navigation.tabId, host }, latest.sequence);
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
