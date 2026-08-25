import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import type { Browser } from 'wxt/browser';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
interface PackageMetadata {
  name: string;
  version: string;
  homepage: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;
}

const manifest = readJson<Browser.runtime.Manifest>('.output/chrome-mv3/manifest.json');
const pkg = readJson<PackageMetadata>('package.json');

test('the manifest and package.json agree on the version', () => {
  assert.equal(manifest.version, pkg.version);
});

test('the extension uses the lowercase torwache identity', () => {
  assert.equal(manifest.name, 'torwache');
  assert.equal(manifest.action.default_title, manifest.name);
  assert.equal(pkg.name, manifest.name);
});

test("the Store description is accurate and within Chrome's limit", () => {
  assert.equal(
    manifest.description,
    'Simple website blocker. Blocks the sites on your list and nothing else. No telemetry, no accounts, no cloud sync.',
  );
  assert.ok(manifest.description.length <= 132);
});

test('the official website is the torwache domain', () => {
  assert.equal(manifest.homepage_url, 'https://torwache.com/');
  assert.equal(pkg.homepage, manifest.homepage_url);
});

/**
 * The extension must not receive page contents or inject code. That property
 * belongs in the manifest, so it is checked here rather than trusted.
 */
test('it asks for three permissions and nothing else', () => {
  assert.deepEqual(manifest.permissions, ['storage', 'declarativeNetRequest', 'webNavigation']);
});

test('it takes no access to any page', () => {
  for (const key of [
    'host_permissions',
    'optional_host_permissions',
    'optional_permissions',
    'content_scripts',
    'web_accessible_resources',
    'externally_connectable',
    'devtools_page',
  ]) {
    assert.equal(manifest[key], undefined, `${key} must not be declared`);
  }
});

test('it is Manifest V3 with an explicit content security policy', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(
    typeof manifest.content_security_policy === 'object' &&
      manifest.content_security_policy !== null,
  );
  assert.equal(
    manifest.content_security_policy.extension_pages,
    "script-src 'self'; object-src 'self'",
  );
});

test('it declares the oldest Chrome it actually works on', () => {
  // light-dark() in the stylesheet is the binding constraint.
  assert.ok(manifest.minimum_chrome_version);
  assert.match(manifest.minimum_chrome_version, /^\d+$/);
  assert.ok(Number(manifest.minimum_chrome_version) >= 123);
});

test('no unrecognised manifest keys, which Chrome would warn about', () => {
  const known = new Set([
    'manifest_version',
    'name',
    'version',
    'description',
    'minimum_chrome_version',
    'homepage_url',
    'content_security_policy',
    'incognito',
    'permissions',
    'background',
    'options_ui',
    'action',
    'icons',
  ]);
  for (const key of Object.keys(manifest)) {
    assert.ok(known.has(key), `unexpected manifest key: ${key}`);
  }
});

test('every file the manifest points at exists', () => {
  const background = manifest.background;
  assert.ok(background && 'service_worker' in background && background.service_worker);
  assert.ok(manifest.options_ui?.page);
  assert.ok(manifest.icons);
  const actionIcon = manifest.action?.default_icon;
  assert.ok(actionIcon && typeof actionIcon === 'object');
  const referenced = [
    background.service_worker,
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(actionIcon),
  ];
  for (const file of referenced) {
    assert.ok(existsSync(join(ROOT, '.output/chrome-mv3', String(file))), `missing: ${file}`);
  }
});

test('WXT emits the extension stylesheet into the production build', () => {
  assert.match(readFileSync(join(ROOT, '.output/chrome-mv3/options.html'), 'utf8'), /\.css/);
});

test('packaged pages load no remote resources and contain no background network client', () => {
  const packageRoot = join(ROOT, '.output/chrome-mv3');
  const files = packageFiles(packageRoot).filter((file) => /\.(?:css|html|js)$/.test(file));
  const networkClients = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/;
  const remoteResource =
    /<(?:script|img|link)\b[^>]*(?:src|href)=["']https?:|url\(["']?https?:/i;

  for (const file of files) {
    const contents = readFileSync(file, 'utf8');
    assert.doesNotMatch(contents, networkClients, `network client in ${file}`);
    assert.doesNotMatch(contents, remoteResource, `remote resource in ${file}`);

    if (!file.endsWith('.html')) continue;
    for (const anchor of contents.matchAll(/<a\b[^>]*href=["']https?:[^>]*>/gi)) {
      assert.match(anchor[0], /rel=["'][^"']*\bnoreferrer\b[^"']*["']/i);
      assert.match(anchor[0], /target=["']_blank["']/i);
    }
  }
});

function packageFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? packageFiles(path) : [path];
  });
}
