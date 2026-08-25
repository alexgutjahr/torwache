import { browser } from 'wxt/browser';

const PAGE = '/blocked.html';
const PARAM = 'host';

/** Builds a page URL that carries only the canonical hostname. */
export function blockedPageUrl(blockedHost: string): string {
  const host = canonicalHost(blockedHost);
  const page = browser.runtime.getURL(PAGE);
  return host ? `${page}?${PARAM}=${encodeURIComponent(host)}` : page;
}

export function blockedHostFrom(search: string): string {
  return canonicalHost(new URLSearchParams(search).get(PARAM) ?? '');
}

function canonicalHost(value: string): string {
  if (!value || value.includes('\\') || /[\s/:?#@[\]]/.test(value)) return '';
  try {
    const parsed = new URL(`https://${value}`);
    return parsed.hostname.replace(/\.$/, '').toLowerCase();
  } catch {
    return '';
  }
}
