import { browser } from 'wxt/browser';

import { blockedHostFrom } from '../../lib/blocked-page';
import { query } from '../../lib/dom';
import { describeScope, findBlockerForHost } from '../../lib/domains';
import { readEntries } from '../../lib/store';

const host = blockedHostFrom(location.search);
query(document, '#host', HTMLParagraphElement).textContent = host;
if (host) document.title = `Blocked — ${host}`;

query(document, '#open', HTMLButtonElement).addEventListener('click', () => {
  void browser.runtime.openOptionsPage();
});

const entry = host ? findBlockerForHost(host, await readEntries()) : null;
if (entry) {
  query(document, '#matched', HTMLParagraphElement).textContent =
    `Matched your entry for ${describeScope(entry)}`;
}
