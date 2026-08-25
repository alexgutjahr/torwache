import { next } from '@vercel/functions';

import {
  canonicalPathForMarkdown,
  isDocumentPath,
  markdownPathFor,
  normalizeDocumentPath,
  preferredType,
} from './src/lib/content-negotiation';

const VARY = 'Accept, Accept-Encoding';
const MARKDOWN_404 = `# 404 — Page not found

The requested path does not exist on torwache.com.

- [Homepage](https://torwache.com/)
- [Guides](https://torwache.com/guides/)
- [Comparisons](https://torwache.com/compare/)
- [Sitemap](https://torwache.com/sitemap-index.xml)
- [Agent guide](https://torwache.com/llms.txt)
`;

function linkHeader(canonicalPath: string, markdownPath: string): string {
  return `<${markdownPath}>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby", <${canonicalPath}>; rel="canonical"`;
}

function isAssetPath(pathname: string): boolean {
  const name = pathname.split('/').at(-1) ?? '';
  return pathname.startsWith('/_astro/') || (name.includes('.') && !name.endsWith('.md'));
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  if (pathname === '/404.md') {
    return new Response(request.method === 'HEAD' ? null : MARKDOWN_404, {
      status: 404,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        Link: '</llms.txt>; rel="describedby", </404>; rel="canonical"',
        Vary: VARY,
      },
    });
  }

  const directMarkdownCanonical = canonicalPathForMarkdown(pathname);
  if (directMarkdownCanonical && isDocumentPath(directMarkdownCanonical)) {
    return next({
      headers: {
        Link: linkHeader(directMarkdownCanonical, pathname),
        Vary: VARY,
      },
    });
  }

  if (isAssetPath(pathname)) return next();

  const representation = preferredType(request.headers.get('accept'));
  if (!isDocumentPath(pathname)) {
    if (representation === 'text/markdown') {
      return new Response(request.method === 'HEAD' ? null : MARKDOWN_404, {
        status: 404,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          Link: '</llms.txt>; rel="describedby"',
          Vary: VARY,
        },
      });
    }
    return next({ headers: { Vary: VARY } });
  }

  const canonicalPath = normalizeDocumentPath(pathname);
  const markdownPath = markdownPathFor(canonicalPath);
  const links = linkHeader(canonicalPath, markdownPath);

  if (representation === null) {
    return new Response('Not Acceptable\n\nAvailable: text/html, text/markdown\n', {
      status: 406,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Link: links,
        Vary: VARY,
      },
    });
  }

  if (representation === 'text/html') {
    return next({ headers: { Link: links, Vary: VARY } });
  }

  const markdownResponse = await fetch(new URL(markdownPath, request.url), {
    method: request.method,
    headers: { Accept: 'text/markdown' },
  });
  if (!markdownResponse.ok) {
    return new Response('Markdown representation unavailable\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', Vary: VARY },
    });
  }

  return new Response(request.method === 'HEAD' ? null : markdownResponse.body, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: links,
      Vary: VARY,
    },
  });
}
