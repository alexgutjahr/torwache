import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import { expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const WEBSITE = join(ROOT, 'website', 'dist');

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const routes = [
  { path: '/', status: 200 },
  { path: '/about/', status: 200 },
  { path: '/contact/', status: 200 },
  { path: '/guides/', status: 200 },
  { path: '/guides/free-website-blocker/', status: 200 },
  { path: '/guides/how-to-block-websites-on-chrome/', status: 200 },
  { path: '/guides/open-source-website-blocker/', status: 200 },
  { path: '/guides/website-blocker-extension/', status: 200 },
  { path: '/compare/', status: 200 },
  { path: '/compare/blocksite/', status: 200 },
  { path: '/compare/stayfocusd/', status: 200 },
  { path: '/compare/cold-turkey/', status: 200 },
  { path: '/compare/freedom/', status: 200 },
  { path: '/privacy/', status: 200 },
  { path: '/imprint/', status: 200 },
  { path: '/this-path-does-not-exist/', status: 404 },
];
const viewports = [
  { name: 'small phone', width: 320, height: 700 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

test('the website fits its content and keeps primary navigation usable at every breakpoint', {
  timeout: 60_000,
}, async () => {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      const relative = normalize(pathname).replace(/^[/\\]+/, '');
      let file = join(WEBSITE, relative);
      if ((await stat(file).catch(() => undefined))?.isDirectory())
        file = join(file, 'index.html');
      const body = await readFile(file);
      response.setHeader(
        'Content-Type',
        MIME_TYPES[extname(file)] ?? 'application/octet-stream',
      );
      response.end(body);
    } catch {
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(await readFile(join(WEBSITE, '404.html')));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  let browser: Browser | undefined;

  try {
    browser = await puppeteer.launch({
      pipe: true,
      args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
    });
    const page = await browser.newPage();

    for (const viewport of viewports) {
      await page.setViewport(viewport);

      for (const route of routes) {
        const navigation = await page.goto(`http://127.0.0.1:${address.port}${route.path}`, {
          waitUntil: 'domcontentloaded',
        });
        expect(navigation?.status(), `${route.path} returned the wrong status`).toBe(
          route.status,
        );
        await page.evaluate(async () => document.fonts.ready);

        const result = await page.evaluate(() => {
          const navLinks = [...document.querySelectorAll<HTMLElement>('.header-nav a')];
          const install = document.querySelector<HTMLElement>('.header-install');
          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            navVisible: navLinks.every((link) => {
              const rect = link.getBoundingClientRect();
              return rect.width > 0 && rect.height >= 24;
            }),
            installVisible: Boolean(install && install.getBoundingClientRect().height >= 24),
          };
        });

        expect(
          result.overflow,
          `${route.path} overflows at ${viewport.name}`,
        ).toBeLessThanOrEqual(0);
        expect(result.navVisible, `navigation is unusable at ${viewport.name}`).toBe(true);
        expect(result.installVisible, `install link is unusable at ${viewport.name}`).toBe(
          true,
        );
      }
    }
  } finally {
    await browser?.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
