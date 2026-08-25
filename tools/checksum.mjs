import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (typeof version !== 'string') throw new TypeError('package.json has no string version');

const archive = join(ROOT, '.output', `torwache-${version}-chrome.zip`);
const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync(join(ROOT, '.output', 'SHA256SUMS'), `${checksum}  ${basename(archive)}\n`);
console.log(`${basename(archive)}  ${checksum}`);
