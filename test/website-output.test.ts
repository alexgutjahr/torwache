import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { documentPaths, markdownPathFor } from '../website/src/lib/content-negotiation';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'website', 'dist');

function outputPath(route: string, extension = 'html'): string {
  if (route === '/') return join(DIST, `index.${extension}`);
  return join(DIST, route.replace(/^\//, ''), `index.${extension}`);
}

function textContent(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mainText(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  return textContent(main);
}

describe('static website output', () => {
  test('the homepage contains substantial semantic content without JavaScript', () => {
    const html = readFileSync(outputPath('/'), 'utf8');
    const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));

    expect(mainText(html).length).toBeGreaterThan(500);
    expect(headings.filter((level) => level === 1)).toHaveLength(1);
    expect(headings).toContain(2);
    expect(headings).toContain(3);
    for (const [index, level] of headings.entries()) {
      if (index === 0) expect(level).toBe(1);
      else expect(level - (headings[index - 1] ?? level)).toBeLessThanOrEqual(1);
    }
    expect(html).toContain('Dead-simple website blocking for Chrome');
    expect(html).toContain('<meta name="application-name" content="torwache">');
  });

  test.each(['/about/', '/contact/', '/privacy/'])(
    '%s is a substantive trust page',
    (route) => {
      const html = readFileSync(outputPath(route), 'utf8');
      expect(mainText(html).length).toBeGreaterThan(500);
      expect(html.match(/<h1\b/gi)).toHaveLength(1);
    },
  );

  test('the static 404 gives humans and agents useful recovery routes', () => {
    const html = readFileSync(join(DIST, '404.html'), 'utf8');

    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain('Page not found.');
    expect(html).toContain('href="/sitemap-index.xml"');
    expect(html).toContain('href="/llms.txt"');
  });

  test('llms.txt follows the v2 structure and contains specific when-to-use guidance', () => {
    const llms = readFileSync(join(DIST, 'llms.txt'), 'utf8');
    const firstLines = llms.split('\n').slice(0, 3);
    const sections = llms.split(/^## /m).slice(1);

    expect(firstLines[0]).toBe('# torwache');
    expect(firstLines[2]).toMatch(/^> /);
    expect(llms).toContain('## When to use torwache');
    expect(llms).toContain('persistent Chrome domain blocklist');
    expect(sections.length).toBeGreaterThanOrEqual(4);
    for (const section of sections) expect(section).toMatch(/\n- \[[^\]]+\]\(https:\/\//);
  });

  test('the sitemap contains every indexable trust page', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const route of ['/about/', '/contact/', '/privacy/', '/imprint/']) {
      expect(sitemap).toContain(`<loc>https://torwache.com${route}</loc>`);
    }
  });

  test('every public document has a discoverable generated Markdown representation', () => {
    for (const route of documentPaths) {
      const html = readFileSync(outputPath(route), 'utf8');
      const markdown = readFileSync(outputPath(route, 'md'), 'utf8');
      const markdownPath = markdownPathFor(route);

      expect(html).toContain(`rel="alternate" type="text/markdown" href="${markdownPath}"`);
      expect(html).toContain('rel="describedby" href="/llms.txt"');
      expect(markdown).toMatch(/^---\ntitle: /);
      expect(markdown).toContain(`canonical_url: https://torwache.com${route}`);
      expect(markdown).not.toContain('\nlast_updated:');
      expect(markdown).toMatch(/\n# /);
      expect(markdown).not.toContain('<main');
    }

    const privacyMarkdown = readFileSync(outputPath('/privacy/', 'md'), 'utf8');
    expect(privacyMarkdown).toContain('https://torwache.com/privacy/#extension');
    expect(privacyMarkdown).toContain('https://torwache.com/privacy/#website');
    const homeMarkdown = readFileSync(outputPath('/', 'md'), 'utf8');
    expect(homeMarkdown).toContain('[How-to Block websites on Chrome]');
  });

  test('all pages publish complete organization and website schema', () => {
    const html = readFileSync(outputPath('/'), 'utf8');
    const scripts = [
      ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ];
    const schemas = scripts.flatMap((match) => {
      const parsed = JSON.parse(match[1] ?? 'null') as unknown;
      return Array.isArray(parsed) ? parsed : [parsed];
    }) as Array<Record<string, unknown>>;
    const organization = schemas.find((schema) => schema['@type'] === 'Organization');
    const website = schemas.find((schema) => schema['@type'] === 'WebSite');

    expect(organization).toMatchObject({
      name: 'iconic.one GmbH',
      email: 'hello@torwache.com',
      address: {
        '@type': 'PostalAddress',
        postalCode: '10245',
        addressLocality: 'Berlin',
        addressCountry: 'DE',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'hello@torwache.com',
      },
    });
    expect(website).toMatchObject({
      name: 'torwache',
      publisher: { '@id': 'https://torwache.com/#organization' },
    });
  });

  test('public contact routes use torwache role addresses', () => {
    const contact = readFileSync(outputPath('/contact/'), 'utf8');
    const privacy = readFileSync(outputPath('/privacy/'), 'utf8');

    expect(contact).toContain('mailto:hello@torwache.com');
    expect(contact).toContain('mailto:privacy@torwache.com');
    expect(contact).toContain('mailto:security@torwache.com');
    expect(privacy).toContain('mailto:privacy@torwache.com');
    expect(privacy).toContain('Chrome Web Store User Data Policy');
    expect(privacy).toContain('Limited Use requirements');
    expect(`${contact}${privacy}`).not.toContain('@iconic.one');
  });

  test('deployment headers declare Markdown content and cache variance', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'website', 'vercel.json'), 'utf8')) as {
      trailingSlash?: boolean;
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const markdownHeaders = config.headers.find(({ source }) => source.includes('md'))?.headers;

    expect(markdownHeaders).toEqual(
      expect.arrayContaining([
        { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
        { key: 'Vary', value: 'Accept, Accept-Encoding' },
      ]),
    );
    expect(config.trailingSlash).toBeUndefined();
  });
});
