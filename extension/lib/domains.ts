import { parse as parseDomain } from 'tldts';
import type { Browser } from 'wxt/browser';

/** One row of the blocklist. */
export interface Entry {
  id: string;
  /** Bare, lowercase, punycode hostname. */
  domain: string;
  includeSubdomains: boolean;
  enabled: boolean;
}

export type ParsedDomain = { domain: string } | { error: string };

const LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_HOST_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;
const RULE_PRIORITY = 1;
const FIRST_RULE_ID = 1;
const MAIN_FRAME = 'main_frame' as Browser.declarativeNetRequest.ResourceType;

/**
 * Not scripts or images: the job is "this site must not open", not "scrub it
 * from other people's pages".
 */
const RESOURCE_TYPES: Browser.declarativeNetRequest.ResourceType[] = [
  MAIN_FRAME,
  'sub_frame' as Browser.declarativeNetRequest.ResourceType,
];

/** Accepts anything a person might paste: a URL, host, or host with a port. */
export function normalizeDomain(raw: unknown): ParsedDomain {
  const input = String(raw ?? '').trim();
  if (!input) return { error: 'Enter a domain.' };
  if (/\s/.test(input)) return { error: 'A domain cannot contain spaces.' };

  const bare = input.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '');
  if (!bare) return { error: `"${input}" is not a valid domain.` };

  let host: string;
  try {
    // URL strips paths, queries, ports, and userinfo; lowercases; and converts
    // internationalised names to punycode.
    host = new URL(`http://${bare}`).hostname.replace(/\.$/, '');
  } catch {
    return { error: `"${input}" is not a valid domain.` };
  }

  if (!host) return { error: `"${input}" is not a valid domain.` };
  if (host.startsWith('[')) return { error: 'IP addresses in brackets are not supported.' };
  if (host.length > MAX_HOST_LENGTH) return { error: 'That domain is too long.' };

  // "www" is not a subdomain anyone means to distinguish. Store the bare
  // domain, so pasting a www URL cannot produce an entry that misses the site.
  let labels = host.split('.');
  if (labels[0] === 'www' && labels.length > 2) {
    labels = labels.slice(1);
    host = labels.join('.');
  }

  if (labels.length < 2) return { error: 'Use a full domain, like youtube.com.' };
  for (const label of labels) {
    if (label.length > MAX_LABEL_LENGTH || !LABEL.test(label)) {
      return { error: `"${input}" is not a valid domain.` };
    }
  }

  const parsed = parseDomain(host, { allowPrivateDomains: true });
  if (!parsed.isIp && parsed.domain === null) {
    return { error: 'Use a registrable domain, not a public suffix.' };
  }
  return { domain: host };
}

/** The only door out of storage, so everything downstream can trust the shape. */
export function toEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isEntry).map(({ id, domain, includeSubdomains, enabled }) => ({
    id,
    domain,
    includeSubdomains,
    enabled,
  }));
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== 'string' ||
    !entry.id ||
    typeof entry.domain !== 'string' ||
    typeof entry.includeSubdomains !== 'boolean' ||
    typeof entry.enabled !== 'boolean'
  ) {
    return false;
  }

  const parsed = normalizeDomain(entry.domain);
  return 'domain' in parsed && parsed.domain === entry.domain;
}

/** Keeps chrome:// and the extension's own pages out of every caller below. */
export function hostOf(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return parsed.hostname.replace(/\.$/, '') || null;
}

/** A narrow entry still covers www because otherwise it would miss most sites. */
export function entryCovers(entry: Entry, host: string): boolean {
  if (host === entry.domain) return true;
  if (entry.includeSubdomains) return host.endsWith(`.${entry.domain}`);
  return host === `www.${entry.domain}`;
}

export function findBlocker(url: string, entries: readonly Entry[]): Entry | null {
  const host = hostOf(url);
  return host ? findBlockerForHost(host, entries) : null;
}

export function findBlockerForHost(host: string, entries: readonly Entry[]): Entry | null {
  return entries.find((entry) => entry.enabled && entryCovers(entry, host)) ?? null;
}

export function describeScope(entry: Entry): string {
  return entry.includeSubdomains ? `${entry.domain} and its subdomains` : entry.domain;
}

/** Ids are positional because the whole dynamic ruleset is replaced at once. */
export function buildRules(entries: readonly Entry[]): Browser.declarativeNetRequest.Rule[] {
  const rules: Browser.declarativeNetRequest.Rule[] = [];
  for (const entry of entries) {
    if (!entry.enabled) continue;
    rules.push({
      id: rules.length + FIRST_RULE_ID,
      priority: RULE_PRIORITY,
      action: { type: 'block' },
      condition: entry.includeSubdomains
        ? { requestDomains: [entry.domain], resourceTypes: RESOURCE_TYPES }
        : { regexFilter: exactHostRegex(entry.domain), resourceTypes: RESOURCE_TYPES },
    });
  }
  return rules;
}

/** Checks the last-known DNR rules when storage is temporarily unavailable. */
export function rulesBlockHost(
  rules: readonly Browser.declarativeNetRequest.Rule[],
  host: string,
): boolean {
  const url = `https://${host}/`;
  return rules.some((rule) => {
    if (rule.action.type !== 'block') return false;
    const resourceTypes = rule.condition.resourceTypes;
    if (resourceTypes && !resourceTypes.includes(MAIN_FRAME)) return false;

    if (
      rule.condition.requestDomains?.some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      )
    ) {
      return true;
    }
    if (!rule.condition.regexFilter) return false;
    try {
      return new RegExp(rule.condition.regexFilter).test(url);
    } catch {
      return false;
    }
  });
}

/** Matches this host and its www form, and no other subdomain. */
function exactHostRegex(domain: string): string {
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^https?://(?:www\\.)?${escaped}(?::\\d+)?(?:[/?#]|$)`;
}
