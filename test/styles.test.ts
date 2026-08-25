import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = readFileSync(join(ROOT, 'shared', 'styles', 'tokens.css'), 'utf8');
const COMPONENTS = readFileSync(join(ROOT, 'extension', 'css', 'components.css'), 'utf8');

function componentRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = COMPONENTS.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match?.[1], `missing component rule ${selector}`);
  return match[1];
}

function themeColours(name: string): readonly [string, string] {
  const match = TOKENS.match(
    new RegExp(`--bx-${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`, 'i'),
  );
  assert.ok(match?.[1] && match[2], `missing light-dark token --bx-${name}`);
  return [match[1], match[2]];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('faint text meets WCAG AA on page and card backgrounds in both themes', () => {
  const faint = themeColours('faint');
  const backgrounds = [themeColours('bg'), themeColours('card')];

  for (const theme of [0, 1] as const) {
    for (const background of backgrounds) {
      assert.ok(
        contrast(faint[theme], background[theme]) >= 4.5,
        `${faint[theme]} on ${background[theme]} must reach 4.5:1`,
      );
    }
  }
});

test('inactive control strokes meet non-text contrast in both themes', () => {
  const off = themeColours('off');
  const backgrounds = [themeColours('bg'), themeColours('card')];

  for (const theme of [0, 1] as const) {
    for (const background of backgrounds) {
      assert.ok(
        contrast(off[theme], background[theme]) >= 3,
        `${off[theme]} on ${background[theme]} must reach 3:1`,
      );
    }
  }
});

test('shared controls reset native browser appearance without relying on Tailwind', () => {
  for (const selector of ['.field', '.btn', '.switch', '.checkbox']) {
    const rule = componentRule(selector);
    assert.match(rule, /appearance:\s*none/);
    assert.match(rule, /margin:\s*0/);
  }

  const switchRule = componentRule('.switch');
  assert.match(switchRule, /border:\s*0/);
  assert.match(switchRule, /padding:\s*0/);
});

test('extension pages block first paint on CSS and reserve logo space', () => {
  const logoSizes = { options: '40', blocked: '44' } as const;
  for (const [page, size] of Object.entries(logoSizes)) {
    const html = readFileSync(
      join(ROOT, 'extension', 'entrypoints', page, 'index.html'),
      'utf8',
    );
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /<link rel="stylesheet" href="\.\.\/\.\.\/css\/main\.css" \/>/);
    assert.match(
      html,
      new RegExp(`<img src="/icons/mark\\.svg" alt="" width="${size}" height="${size}"`),
    );
  }
});

test('reduced-motion mode removes authored delays as well as durations', () => {
  const base = readFileSync(join(ROOT, 'extension', 'css', 'base.css'), 'utf8');
  const reducedMotion = base.slice(base.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reducedMotion, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(reducedMotion, /animation-delay:\s*0ms\s*!important/);
  assert.match(reducedMotion, /animation-iteration-count:\s*1\s*!important/);
});
