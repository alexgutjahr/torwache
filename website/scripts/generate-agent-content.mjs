import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import TurndownService from 'turndown';

const SITE = 'https://torwache.com';
const DIST = resolve(import.meta.dirname, '..', 'dist');

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? findHtmlFiles(path) : [path];
    }),
  );
  return files.flat().filter((path) => path.endsWith('.html'));
}

function routeFor(file) {
  const local = relative(DIST, file).split(sep).join('/');
  if (local === 'index.html') return '/';
  if (local === '404.html') return '/404';
  return `/${local.replace(/index\.html$/, '')}`;
}

function markdownPathFor(file) {
  return file.endsWith('/404.html')
    ? file.replace(/404\.html$/, '404.md')
    : file.replace(/\.html$/, '.md');
}

function absoluteUrl(href, canonical) {
  if (href.startsWith('#')) return `${canonical}${href}`;
  return new URL(href, canonical).href;
}

function createTurndown(canonical) {
  const turndown = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    headingStyle: 'atx',
  });

  turndown.addRule('removeInterfaceChrome', {
    filter: (node) =>
      node.nodeType === 1 &&
      (node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('inert')),
    replacement: () => '',
  });

  turndown.addRule('definitionBlocks', {
    filter: ['dt', 'dd'],
    replacement: (content) => `\n\n${content}\n\n`,
  });

  turndown.addRule('definitionDetail', {
    filter: (node) => node.nodeName === 'SPAN' && node.parentNode?.nodeName === 'DD',
    replacement: (content) => `\n\n${content}`,
  });

  turndown.addRule('absoluteLinks', {
    filter: 'a',
    replacement: (content, node) => {
      const href = node.getAttribute('href');
      if (!href) return content;
      const parentClasses = node.parentNode?.getAttribute?.('class') ?? '';
      const isLinkGroup =
        /(?:actions|closing-links|comparison-link-list|policy-sections|recovery-links)/.test(
          parentClasses,
        );
      const label = isLinkGroup
        ? Array.from(node.childNodes)
            .filter((child) => child.getAttribute?.('aria-hidden') !== 'true')
            .map((child) => (child.textContent ?? '').trim())
            .filter(Boolean)
            .join(' ')
        : content;
      const link = `[${label}](${absoluteUrl(href, canonical)})`;
      return isLinkGroup ? `\n\n${link}\n\n` : link;
    },
  });

  return turndown;
}

for (const file of await findHtmlFiles(DIST)) {
  const html = await readFile(file, 'utf8');
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (!main) continue;

  const route = routeFor(file);
  const canonical = route === '/404' ? `${SITE}/404` : new URL(route, SITE).href;
  const mdPath =
    route === '/404' ? '/404.md' : route === '/' ? '/index.md' : `${route}index.md`;
  const markdown = createTurndown(canonical)
    .turndown(main)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? 'torwache';
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `canonical_url: ${canonical}`,
    `md_url: ${new URL(mdPath, SITE).href}`,
    '---',
    '',
  ].join('\n');

  await writeFile(markdownPathFor(file), `${frontmatter}${markdown}\n`, 'utf8');
}
