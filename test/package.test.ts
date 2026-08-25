import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  version: string;
};
const ARCHIVE = `torwache-${PACKAGE.version}-chrome.zip`;

test('release packaging is byte-for-byte reproducible', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'torwache-package-'));
  try {
    cpSync(join(ROOT, 'package.json'), join(sandbox, 'package.json'));
    cpSync(join(ROOT, 'extension'), join(sandbox, 'extension'), { recursive: true });
    cpSync(join(ROOT, 'shared'), join(sandbox, 'shared'), { recursive: true });
    cpSync(join(ROOT, 'wxt.config.ts'), join(sandbox, 'wxt.config.ts'));
    symlinkSync(join(ROOT, 'node_modules'), join(sandbox, 'node_modules'), 'dir');

    packageExtension(sandbox);
    const archivePath = join(sandbox, '.output', ARCHIVE);
    const first = readFileSync(archivePath);
    const entries = listArchive(archivePath);
    assert.ok(entries.includes('manifest.json'), 'manifest.json must be at the ZIP root');
    assert.ok(entries.includes('background.js'));
    assert.ok(entries.includes('options.html'));
    assert.ok(
      entries.every((entry) => !entry.startsWith(`${ARCHIVE.replace(/\.zip$/, '')}/`)),
      'the ZIP must not wrap extension files in a top-level folder',
    );

    const changedTime = new Date('2030-01-01T00:00:00Z');
    utimesSync(join(sandbox, 'extension/public/icons/mark.svg'), changedTime, changedTime);
    packageExtension(sandbox);
    const second = readFileSync(join(sandbox, '.output', ARCHIVE));

    assert.deepEqual(second, first);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

function packageExtension(directory: string): void {
  const result = spawnSync(
    process.execPath,
    [join(ROOT, 'node_modules/wxt/bin/wxt.mjs'), 'zip'],
    {
      cwd: directory,
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function listArchive(path: string): string[] {
  const result = spawnSync('unzip', ['-Z1', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.split('\n').filter(Boolean);
}
