import { afterEach, describe, expect, test, vi } from 'vitest';

import middleware from '../website/middleware';
import {
  canonicalPathForMarkdown,
  isDocumentPath,
  markdownPathFor,
  preferredType,
} from '../website/src/lib/content-negotiation';

describe('Accept negotiation', () => {
  test.each([
    [null, 'text/html'],
    ['', 'text/html'],
    ['*/*', 'text/html'],
    ['text/html', 'text/html'],
    ['text/markdown', 'text/markdown'],
    ['text/markdown, text/html;q=0.8', 'text/markdown'],
    ['text/markdown;q=0.5, text/html;q=0.8', 'text/html'],
    ['text/html;q=0, */*;q=1', 'text/markdown'],
    ['text/markdown;q=0, text/html', 'text/html'],
    ['application/pdf', null],
  ])('chooses %s as %s', (accept, expected) => {
    expect(preferredType(accept)).toBe(expected);
  });

  test('uses the most specific media range before a wildcard', () => {
    expect(preferredType('text/*;q=0.3, text/markdown;q=0.7, */*;q=0.9')).toBe('text/markdown');
  });
});

describe('document representation paths', () => {
  test('normalizes route variants and maps Markdown siblings', () => {
    expect(isDocumentPath('/about')).toBe(true);
    expect(isDocumentPath('/does-not-exist')).toBe(false);
    expect(markdownPathFor('/')).toBe('/index.md');
    expect(markdownPathFor('/about')).toBe('/about/index.md');
    expect(canonicalPathForMarkdown('/index.md')).toBe('/');
    expect(canonicalPathForMarkdown('/about/index.md')).toBe('/about/');
    expect(canonicalPathForMarkdown('/about.md')).toBeNull();
  });
});

describe('routing middleware', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('serves the Markdown variant with cache-safe negotiation headers', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('# torwache\n'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await middleware(
      new Request('https://torwache.com/', {
        headers: { Accept: 'text/markdown' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding');
    expect(response.headers.get('link')).toContain('</index.md>; rel="alternate"');
    expect(await response.text()).toBe('# torwache\n');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://torwache.com/index.md');
  });

  test('returns a real Markdown 404 with recovery links for an unknown route', async () => {
    const response = await middleware(
      new Request('https://torwache.com/this-path-does-not-exist', {
        headers: { Accept: 'text/markdown' },
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('vary')).toContain('Accept');
    await expect(response.text()).resolves.toContain(
      '[Agent guide](https://torwache.com/llms.txt)',
    );
  });

  test('keeps the explicit Markdown error document at 404 status', async () => {
    const response = await middleware(
      new Request('https://torwache.com/404.md', {
        headers: { Accept: 'text/markdown' },
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    await expect(response.text()).resolves.toContain('# 404 — Page not found');
  });

  test('returns 406 when no available representation is acceptable', async () => {
    const response = await middleware(
      new Request('https://torwache.com/about/', {
        headers: { Accept: 'application/pdf' },
      }),
    );

    expect(response.status).toBe(406);
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding');
  });
});
