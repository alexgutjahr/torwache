import { browser } from 'wxt/browser';

import { query } from '../../lib/dom';
import { buildRules, describeScope, type Entry, normalizeDomain } from '../../lib/domains';
import {
  type EntryMutation,
  type MutationErrorCode,
  mutationRequest,
  parseMutationResponse,
  parseSyncResponse,
  type RuleErrorCode,
  syncRequest,
} from '../../lib/protocol';
import {
  applyEntryMutation,
  ENTRIES_KEY,
  entriesFromStorage,
  newEntry,
  readEntries,
  rulesMatch,
  StoredEntriesError,
} from '../../lib/store';

type Theme = 'light' | 'system' | 'dark';
const MAX_STAGGERED_ROWS = 10;
const ROW_STAGGER_MS = 30;

interface SaveOptions {
  mutation: EntryMutation;
  submittedDomain?: string;
}

const form = query(document, '#add-form', HTMLFormElement);
const input = query(document, '#domain', HTMLInputElement);
const subsBox = query(document, '#subs', HTMLInputElement);
const errorEl = query(document, '#error', HTMLParagraphElement);
const listEl = query(document, '#list', HTMLUListElement);
const emptyEl = query(document, '#empty', HTMLDivElement);
const countsEl = query(document, '#counts', HTMLParagraphElement);
const template = query(document, '#row-template', HTMLTemplateElement);
const buildEl = query(document, '#build', HTMLParagraphElement);
const enforcingEl = query(document, '#enforcing', HTMLSpanElement);
const statusDot = query(document, '#status-dot', HTMLSpanElement);
const submitButton = query(form, 'button[type="submit"]', HTMLButtonElement);
const retryButton = query(document, '#retry-storage', HTMLButtonElement);
const resetButton = query(document, '#reset-storage', HTMLButtonElement);

const alreadyAnimated = new Set<string>();
let entries: Entry[] = [];
let loaded = false;
let saving = false;
let focusInputWhenReady = false;

const manifest = browser.runtime.getManifest();
buildEl.textContent = `${manifest.name} ${manifest.version} \u00b7 ${browser.runtime.id}`;
query(document, '#website', HTMLAnchorElement).href = manifest.homepage_url ?? '';

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const changed = changes[ENTRIES_KEY];
  if (!changed) return;
  try {
    entries = entriesFromStorage(changed.newValue);
    loaded = true;
  } catch (error) {
    loaded = false;
    showStorageLoadError(error);
  }
  render();
  if (loaded && !saving) {
    void requestRuleSync().then(reportEnforcement).catch(showEnforcementError);
  }
});

retryButton.addEventListener('click', () => void initialise());
bindReset();
void initialise();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!loaded || saving) return;

  const parsed = normalizeDomain(input.value);
  if ('error' in parsed) return fail(parsed.error);
  if (entries.some((entry) => entry.domain === parsed.domain)) {
    return fail(`${parsed.domain} is already on the list.`);
  }

  errorEl.textContent = '';
  input.removeAttribute('aria-invalid');
  const entry = newEntry(parsed.domain, subsBox.checked);
  const mutation: EntryMutation = { type: 'add', entry };
  void save(applyEntryMutation(entries, mutation), {
    mutation,
    submittedDomain: input.value,
  });
});

input.addEventListener('input', () => {
  errorEl.textContent = '';
  input.removeAttribute('aria-invalid');
});

function fail(message: string): void {
  errorEl.textContent = message;
  input.setAttribute('aria-invalid', 'true');
  input.select();
}

async function initialise(): Promise<void> {
  if (saving) return;
  loaded = false;
  render();
  showLoading();

  try {
    entries = await readEntries();
  } catch (error) {
    loaded = false;
    render();
    showStorageLoadError(error);
    return;
  }

  loaded = true;
  render();
  input.focus();
  try {
    await requestRuleSync();
    await reportEnforcement();
  } catch (error) {
    showEnforcementError(error);
  }
}

async function save(next: readonly Entry[], options: SaveOptions): Promise<void> {
  if (!loaded || saving) return;

  const previous = entries;
  saving = true;
  entries = [...next];
  render();

  let ruleError: RuleErrorCode | null;
  try {
    ruleError = await requestEntryMutation(options.mutation);
    // Read after the worker acknowledges the mutation. A second manager may
    // have committed another mutation before this page handles its response;
    // this read cannot overwrite that newer storage event with an older reply.
    entries = await readEntries();
  } catch (error) {
    let loadError: unknown = error;
    try {
      entries = await readEntries();
    } catch (readError) {
      entries = previous;
      loaded = false;
      loadError = readError;
    }
    saving = false;
    render();
    if (options.submittedDomain !== undefined) {
      input.value = options.submittedDomain;
      fail('That domain could not be saved. Try again.');
    }
    if (loaded) showStorageSaveError();
    else showStorageLoadError(loadError);
    return;
  }

  if (options.submittedDomain !== undefined) input.value = '';
  saving = false;
  render();
  if (ruleError) return showEnforcementError(new RuleSyncError(ruleError));
  try {
    await reportEnforcement();
  } catch (error) {
    showEnforcementError(error);
  }
}

async function requestEntryMutation(mutation: EntryMutation): Promise<RuleErrorCode | null> {
  const response = parseMutationResponse(
    await browser.runtime.sendMessage(mutationRequest(mutation)),
  );
  if (!response) throw new MutationError('storage-update');
  if (response.ok) return response.ruleError;
  throw new MutationError(response.error);
}

async function requestRuleSync(): Promise<void> {
  const response = parseSyncResponse(await browser.runtime.sendMessage(syncRequest()));
  if (!response) throw new RuleSyncError('rule-update');
  if (response.ok) return;
  throw new RuleSyncError(response.error);
}

class RuleSyncError extends Error {
  constructor(readonly code: RuleErrorCode) {
    super(code);
    this.name = 'RuleSyncError';
  }
}

class MutationError extends Error {
  constructor(readonly code: MutationErrorCode) {
    super(code);
    this.name = 'MutationError';
  }
}

/** Asks Chrome what it is enforcing instead of trusting the page state. */
async function reportEnforcement(): Promise<void> {
  const rules = await browser.declarativeNetRequest.getDynamicRules();
  const agrees = rulesMatch(rules, buildRules(entries));

  retryButton.hidden = true;
  resetButton.hidden = true;
  enforcingEl.textContent = agrees
    ? `Chrome is enforcing ${count(rules.length, 'block rule')}`
    : `Chrome's ${count(rules.length, 'block rule')} does not match this list. ` +
      'Reload the extension from chrome://extensions.';
  setStatusAlert(!agrees);
}

function showEnforcementError(error?: unknown): void {
  retryButton.hidden = true;
  resetButton.hidden = true;
  enforcingEl.textContent =
    error instanceof RuleSyncError && error.code === 'regex-rule-limit'
      ? 'Chrome has reached its narrow-rule limit. Enable subdomains or remove an entry.'
      : error instanceof RuleSyncError && error.code === 'dynamic-rule-limit'
        ? 'Chrome has reached its block-rule limit. Remove an entry before adding another.'
        : "Chrome's block rules could not be updated or verified. Reload the extension and try again.";
  setStatusAlert(true);
}

function showLoading(): void {
  retryButton.hidden = true;
  resetButton.hidden = true;
  enforcingEl.textContent = 'Loading your blocklist…';
  setStatusAlert(false);
}

function showStorageLoadError(error?: unknown): void {
  const damaged =
    error instanceof StoredEntriesError ||
    (error instanceof MutationError && error.code === 'stored-entries');
  retryButton.hidden = damaged;
  resetButton.hidden = !damaged;
  enforcingEl.textContent = damaged
    ? 'Your stored blocklist is damaged or from an unsupported version.'
    : 'Your blocklist could not be loaded.';
  setStatusAlert(true);
}

function showStorageSaveError(): void {
  retryButton.hidden = true;
  resetButton.hidden = true;
  enforcingEl.textContent = 'Your blocklist could not be saved. Try again.';
  setStatusAlert(true);
}

function setStatusAlert(alert: boolean): void {
  statusDot.toggleAttribute('data-alert', alert);
  enforcingEl.classList.toggle('text-danger', alert);
}

function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

const THEME_KEY = 'theme';
const THEMES = ['light', 'system', 'dark'] as const;
const themeChoices = THEMES.map((choice) =>
  query(document, `[data-theme-choice="${choice}"]`, HTMLInputElement),
);

function applyTheme(choice: Theme): void {
  if (choice === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;

  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // The choice applies now even if localStorage is unavailable.
  }

  for (const choiceInput of themeChoices) {
    choiceInput.checked = choiceInput.value === choice;
  }
}

for (const choiceInput of themeChoices) {
  choiceInput.addEventListener('change', () => {
    if (choiceInput.checked) applyTheme(themeFrom(choiceInput.value));
  });
}
applyTheme(themeFrom(document.documentElement.dataset.theme));

function themeFrom(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : 'system';
}

function update(mutation: EntryMutation): void {
  void save(applyEntryMutation(entries, mutation), { mutation });
}

function render(): void {
  const active = document.activeElement;
  const focusKey = active instanceof HTMLElement ? active.dataset.key : undefined;

  const disabled = !loaded || saving;
  input.disabled = disabled;
  subsBox.disabled = disabled;
  submitButton.disabled = disabled;
  retryButton.disabled = saving;
  resetButton.disabled = saving;
  listEl.replaceChildren(...entries.map(renderRow));
  emptyEl.classList.toggle('hidden', !loaded || entries.length > 0);
  renderCounts();

  if (!focusKey) {
    if (focusInputWhenReady && !input.disabled) {
      focusInputWhenReady = false;
      input.focus();
    }
    return;
  }
  const replacement = listEl.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
  if (replacement instanceof HTMLElement) {
    focusInputWhenReady = false;
    replacement.focus();
  } else if (input.disabled) focusInputWhenReady = true;
  else {
    focusInputWhenReady = false;
    input.focus();
  }
}

function renderCounts(): void {
  countsEl.replaceChildren();
  if (!loaded || !entries.length) return;

  const active = entries.filter((entry) => entry.enabled).length;
  const countElement = document.createElement('span');
  countElement.className = 'font-medium text-fg';
  countElement.textContent = `${active} of ${entries.length}`;
  countsEl.append(countElement, ' active');
}

function renderRow(entry: Entry, index: number): HTMLLIElement {
  const fragment = template.content.cloneNode(true);
  if (!(fragment instanceof DocumentFragment)) throw new Error('expected row fragment');
  const row = query(fragment, 'li', HTMLLIElement);
  const card = query(row, '[data-card]', HTMLDivElement);
  const domain = query(row, '[data-domain]', HTMLParagraphElement);
  const scope = query(row, '[data-scope]', HTMLInputElement);
  const toggle = query(row, '[data-toggle]', HTMLButtonElement);
  const remove = query(row, '[data-remove]', HTMLButtonElement);

  if (alreadyAnimated.has(entry.id)) row.classList.remove('animate-rise');
  else {
    alreadyAnimated.add(entry.id);
    row.style.animationDelay = `${Math.min(index, MAX_STAGGERED_ROWS) * ROW_STAGGER_MS}ms`;
  }

  card.toggleAttribute('data-off', !entry.enabled);
  card.title = entry.enabled
    ? `Blocking ${describeScope(entry)}`
    : `${entry.domain} is switched off and loads normally`;
  domain.textContent = entry.domain;

  scope.dataset.key = `${entry.id}:scope`;
  scope.checked = entry.includeSubdomains;
  scope.disabled = !loaded || saving;
  scope.setAttribute('aria-label', `Include subdomains of ${entry.domain}`);
  scope.addEventListener('change', () => {
    update({ type: 'set-subdomains', id: entry.id, includeSubdomains: scope.checked });
  });

  toggle.dataset.key = `${entry.id}:toggle`;
  toggle.disabled = !loaded || saving;
  toggle.setAttribute('aria-checked', String(entry.enabled));
  toggle.setAttribute('aria-label', `Block ${entry.domain}`);
  toggle.addEventListener('click', () =>
    update({ type: 'set-enabled', id: entry.id, enabled: !entry.enabled }),
  );

  bindRemove(remove, entry);
  remove.disabled = !loaded || saving;
  return row;
}

/** Two clicks ensure one misplaced click cannot drop an entry. */
function bindRemove(button: HTMLButtonElement, entry: Entry): void {
  const disarm = (): void => {
    delete button.dataset.armed;
    button.textContent = 'Remove';
    button.setAttribute('aria-label', `Remove ${entry.domain}`);
  };

  button.dataset.key = `${entry.id}:remove`;
  button.setAttribute('aria-label', `Remove ${entry.domain}`);
  button.addEventListener('click', () => {
    if (button.dataset.armed !== undefined) {
      disarm();
      alreadyAnimated.delete(entry.id);
      const mutation: EntryMutation = { type: 'remove', id: entry.id };
      void save(applyEntryMutation(entries, mutation), { mutation });
      return;
    }
    button.dataset.armed = '';
    button.textContent = 'Confirm';
    button.setAttribute('aria-label', `Confirm removal of ${entry.domain}`);
  });
  button.addEventListener('blur', disarm);
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') disarm();
  });
}

function bindReset(): void {
  const disarm = (): void => {
    delete resetButton.dataset.armed;
    resetButton.textContent = 'Reset blocklist';
    resetButton.setAttribute('aria-label', 'Reset damaged blocklist');
  };

  resetButton.addEventListener('click', () => {
    if (resetButton.dataset.armed !== undefined) {
      disarm();
      void resetBlocklist();
      return;
    }
    resetButton.dataset.armed = '';
    resetButton.textContent = 'Confirm reset';
    resetButton.setAttribute('aria-label', 'Confirm reset of damaged blocklist');
  });
  resetButton.addEventListener('blur', disarm);
  resetButton.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') disarm();
  });
}

async function resetBlocklist(): Promise<void> {
  if (saving) return;
  saving = true;
  render();
  enforcingEl.textContent = 'Resetting your blocklist…';

  let ruleError: RuleErrorCode | null;
  try {
    ruleError = await requestEntryMutation({ type: 'reset' });
    entries = await readEntries();
    loaded = true;
  } catch (error) {
    loaded = false;
    showStorageLoadError(
      error instanceof MutationError && error.code === 'storage-update'
        ? new StoredEntriesError()
        : error,
    );
    saving = false;
    render();
    return;
  }

  saving = false;
  render();
  input.focus();
  if (ruleError) return showEnforcementError(new RuleSyncError(ruleError));
  try {
    await reportEnforcement();
  } catch (error) {
    showEnforcementError(error);
  }
}
