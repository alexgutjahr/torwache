export type Representation = 'text/html' | 'text/markdown';

interface AcceptEntry {
  type: string;
  q: number;
  specificity: number;
}

const representations: readonly Representation[] = ['text/html', 'text/markdown'];

export const documentPaths = [
  '/',
  '/about/',
  '/contact/',
  '/guides/',
  '/guides/free-website-blocker/',
  '/guides/how-to-block-websites-on-chrome/',
  '/guides/open-source-website-blocker/',
  '/guides/website-blocker-extension/',
  '/compare/',
  '/compare/blocksite/',
  '/compare/stayfocusd/',
  '/compare/cold-turkey/',
  '/compare/freedom/',
  '/privacy/',
  '/imprint/',
] as const;

const documentPathSet = new Set<string>(documentPaths);

function parseAccept(header: string): AcceptEntry[] {
  return header.split(',').flatMap((raw) => {
    const [rawType, ...parameters] = raw
      .trim()
      .split(';')
      .map((part) => part.trim());
    const type = rawType?.toLowerCase();
    if (!type?.includes('/')) return [];

    let q = 1;
    for (const parameter of parameters) {
      const [rawName, rawValue] = parameter.split('=').map((part) => part.trim());
      if (rawName?.toLowerCase() !== 'q') continue;
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
    }

    const specificity = type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2;
    return [{ type, q, specificity }];
  });
}

function matches(entry: AcceptEntry, candidate: Representation): boolean {
  if (entry.type === '*/*') return true;
  if (entry.type.endsWith('/*')) return candidate.startsWith(entry.type.slice(0, -1));
  return entry.type === candidate;
}

/** RFC 9110-style server-driven negotiation for HTML and Markdown. */
export function preferredType(header: string | null): Representation | null {
  if (!header) return 'text/html';
  const entries = parseAccept(header);
  if (entries.length === 0) return 'text/html';

  let best: Representation | null = null;
  let bestQ = -1;
  let bestPosition = Number.POSITIVE_INFINITY;

  for (const candidate of representations) {
    let matched: AcceptEntry | null = null;
    let matchedPosition = Number.POSITIVE_INFINITY;

    for (const [position, entry] of entries.entries()) {
      if (!matches(entry, candidate)) continue;
      if (
        matched === null ||
        entry.specificity > matched.specificity ||
        (entry.specificity === matched.specificity && position < matchedPosition)
      ) {
        matched = entry;
        matchedPosition = position;
      }
    }

    if (!matched || matched.q <= 0) continue;
    if (matched.q > bestQ || (matched.q === bestQ && matchedPosition < bestPosition)) {
      best = candidate;
      bestQ = matched.q;
      bestPosition = matchedPosition;
    }
  }

  return best;
}

export function normalizeDocumentPath(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function isDocumentPath(pathname: string): boolean {
  return documentPathSet.has(normalizeDocumentPath(pathname));
}

export function markdownPathFor(pathname: string): string {
  const normalized = normalizeDocumentPath(pathname);
  return normalized === '/' ? '/index.md' : `${normalized}index.md`;
}

export function canonicalPathForMarkdown(pathname: string): string | null {
  if (pathname === '/index.md') return '/';
  if (!pathname.endsWith('/index.md')) return null;
  return pathname.slice(0, -'index.md'.length);
}
