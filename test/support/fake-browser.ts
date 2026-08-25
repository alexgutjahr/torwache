import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';

export interface FakeBrowserState {
  storage: Record<string, unknown>;
  rules: Browser.declarativeNetRequest.Rule[];
  updateCalls: number;
  getRuleCalls: number;
}

interface FakeBrowserOptions {
  entries?: unknown;
  rules?: Browser.declarativeNetRequest.Rule[];
  failUpdates?: number;
  onFailedUpdate?: (state: FakeBrowserState) => void;
  maxDynamicRules?: number;
  maxRegexRules?: number;
}

interface MutableBrowserSlice {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(key: string): Promise<void>;
    };
  };
  declarativeNetRequest: {
    MAX_NUMBER_OF_DYNAMIC_RULES: number;
    MAX_NUMBER_OF_REGEX_RULES: number;
    getDynamicRules(): Promise<Browser.declarativeNetRequest.Rule[]>;
    updateDynamicRules(change: {
      removeRuleIds?: number[];
      addRules?: Browser.declarativeNetRequest.Rule[];
    }): Promise<void>;
  };
}

const mutableBrowser = fakeBrowser as unknown as MutableBrowserSlice;
const original = {
  get: mutableBrowser.storage.local.get,
  set: mutableBrowser.storage.local.set,
  remove: mutableBrowser.storage.local.remove,
  getDynamicRules: mutableBrowser.declarativeNetRequest.getDynamicRules,
  updateDynamicRules: mutableBrowser.declarativeNetRequest.updateDynamicRules,
  maxDynamicRules: mutableBrowser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES,
  maxRegexRules: mutableBrowser.declarativeNetRequest.MAX_NUMBER_OF_REGEX_RULES,
};

export function installFakeBrowser({
  entries,
  rules = [],
  failUpdates = 0,
  onFailedUpdate,
  maxDynamicRules = 30_000,
  maxRegexRules = 1_000,
}: FakeBrowserOptions = {}): FakeBrowserState {
  uninstallFakeBrowser();

  const state: FakeBrowserState = {
    storage: entries === undefined ? {} : { entries },
    rules: structuredClone(rules),
    updateCalls: 0,
    getRuleCalls: 0,
  };
  let failuresLeft = failUpdates;

  mutableBrowser.storage.local.get = async (key) =>
    key in state.storage ? { [key]: state.storage[key] } : {};
  mutableBrowser.storage.local.set = async (items) => {
    Object.assign(state.storage, structuredClone(items));
  };
  mutableBrowser.storage.local.remove = async (key) => {
    delete state.storage[key];
  };

  mutableBrowser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = maxDynamicRules;
  mutableBrowser.declarativeNetRequest.MAX_NUMBER_OF_REGEX_RULES = maxRegexRules;
  mutableBrowser.declarativeNetRequest.getDynamicRules = async () => {
    state.getRuleCalls++;
    return structuredClone(state.rules);
  };
  mutableBrowser.declarativeNetRequest.updateDynamicRules = async ({
    removeRuleIds = [],
    addRules = [],
  }) => {
    state.updateCalls++;
    if (failuresLeft > 0) {
      failuresLeft--;
      onFailedUpdate?.(state);
      throw new Error('simulated race: rule ids already taken');
    }
    state.rules = state.rules
      .filter((rule) => !removeRuleIds.includes(rule.id))
      .concat(structuredClone(addRules));
  };

  return state;
}

export function uninstallFakeBrowser(): void {
  mutableBrowser.storage.local.get = original.get;
  mutableBrowser.storage.local.set = original.set;
  mutableBrowser.storage.local.remove = original.remove;
  mutableBrowser.declarativeNetRequest.getDynamicRules = original.getDynamicRules;
  mutableBrowser.declarativeNetRequest.updateDynamicRules = original.updateDynamicRules;
  mutableBrowser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES = original.maxDynamicRules;
  mutableBrowser.declarativeNetRequest.MAX_NUMBER_OF_REGEX_RULES = original.maxRegexRules;
  fakeBrowser.reset();
}
