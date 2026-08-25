# torwache privacy policy

Effective 25 August 2026

The controller for the torwache browser extension and the torwache.com website is:

<address>
  <strong>iconic.one GmbH</strong><br>
  Scanbox #09285, Ehrenbergstr. 16a<br>
  10245 Berlin<br>
  Germany
</address>

Represented by Alexander Gutjahr. Privacy contact:
[privacy@torwache.com](mailto:privacy@torwache.com).

The extension and website are separate surfaces with different data practices. Fathom Analytics
is loaded only by torwache.com; it is not included in or contacted by the extension. The source code
for both is public in [the torwache repository](https://github.com/alexgutjahr/torwache).

<nav class="policy-sections" aria-label="Privacy policy sections">
  <a href="#extension">Browser extension</a>
  <a href="#website">Website</a>
</nav>

<h2 id="extension">The torwache browser extension</h2>

The Chrome Web Store privacy-policy link points directly to this section. The extension works
locally and does not contain analytics, advertising, user accounts, behavioural tracking, or
remotely hosted code. It loads no remote assets, makes no background network requests, and does not
send blocklist or navigation data to the developer or any third party. Its Website, Source, and
author links open external pages only after you click them; those links use `rel="noreferrer"`.

### Data the extension handles

- **Your blocklist.** Domain names, enabled state, and subdomain preferences are stored in
  `chrome.storage.local` on your device. They are not synced by torwache.
- **Navigation URLs.** Chrome delivers navigation event URLs to torwache through the
  `webNavigation` permission. torwache immediately reduces each full URL to its hostname; paths,
  queries, fragments, and credentials are not retained across the asynchronous blocklist check.
  The hostname is held in service-worker memory for the current navigation check. When a
  navigation is blocked, that hostname is passed to torwache's internal blocked page. torwache
  never writes navigation history to extension storage or transmits it.
- **Theme preference.** A light or dark theme choice is stored in the extension's local browser
  storage.

torwache does not collect identifiers, page content, form data, authentication information,
advertising data, telemetry, or error reports.

### Permissions

- `storage` stores the blocklist locally.
- `declarativeNetRequest` lets Chrome enforce the local blocking rules.
- `webNavigation` lets torwache catch navigations served from a site's service-worker cache and
  replace Chrome's raw blocking error with its own local page.

torwache has no host permissions, content scripts, or access to page contents. If you allow the
extension in Incognito, the same local blocklist is used there; torwache still does not persist or
transmit navigation history.

### Control and deletion

You can edit or remove every stored blocklist entry from torwache. Removing the extension or clearing
its extension data removes torwache's local data. Chrome controls any browser data outside the
extension's storage.

<h2 id="website">The torwache.com website</h2>

torwache.com is a static product and documentation site. It has no user accounts, advertising,
embedded social media, or forms, and it does not set cookies. Its fonts and other visual assets are
served from torwache.com itself. The website uses Fathom Analytics for aggregate usage statistics
and is hosted by Vercel.

### Fathom Analytics

We use Fathom Analytics to understand aggregate page views and referrers so we can evaluate and
improve the website. Fathom is provided by Conva Ventures Inc., 26 Bastion Square, Third Floor,
Burnes House, Victoria, British Columbia, V8W 1H9, Canada, acting as a processor on our behalf.

When you visit torwache.com, your browser loads a deferred script from `cdn.usefathom.com` and sends
a page-view request to Fathom. That request includes the page and referring page and, as part of a
normal web request, your IP address and user-agent information. Fathom uses those details
transiently to count visits and derives aggregate information such as country, browser, and device
type. It does not use cookies and does not store raw IP addresses or user agents alongside browsing
activity. Daily salted visitor hashes are deleted at midnight. Fathom may retain IP-based request
counts for up to 24 hours, and may retain an address longer if needed to block a serious attack.

Fathom routes visitors in the EU through its EU Isolation infrastructure. It processes the raw IP
address on EU servers and converts it to a salted hash before analytics data reaches its US-hosted
infrastructure; the raw EU visitor address does not reach the United States. We configure the
script to honour your browser's Do Not Track setting. If Do Not Track is enabled, Fathom does not
record the visit.

This processing rests on Art. 6(1)(f) GDPR: our legitimate interest in understanding whether the
site is useful and which pages need improvement while using a data-minimising analytics service.
We keep the aggregated reports while they remain useful for those purposes and delete them when
they are no longer needed. You may object to this processing using the privacy contact above.

More information is available in Fathom's
[privacy notice](https://usefathom.com/legal/privacy),
[data-processing agreement](https://usefathom.com/legal/dpa), and
[data journey](https://usefathom.com/data).

### Hosting with Vercel

Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA, hosts torwache.com. Vercel receives
standard connection data such as an IP address, request time, requested path, referrer, and browser
information so it can transmit the site and protect its infrastructure. Vercel processes customer
data on our behalf and may process service-generated data under its own responsibility, as
described in its current contractual and privacy terms. This processing rests on Art. 6(1)(f)
GDPR: our legitimate interest in delivering the site reliably and securely.

Static files are delivered through Vercel's edge network. Before a document is returned, Vercel
runs a small routing middleware that reads the request method, path, and `Accept` header to choose
the HTML or Markdown representation. torwache does not use that middleware to identify visitors or
persist those values. Vercel's [Data Processing Addendum](https://vercel.com/legal/dpa) describes
the safeguards that apply to covered customer plans and international transfers. Vercel's
[Privacy Notice](https://vercel.com/legal/privacy-notice) explains its own processing and
retention.

## Your rights

Where personal data is processed, you may request access (Art. 15 GDPR), rectification (Art. 16),
erasure (Art. 17), restriction (Art. 18), portability (Art. 20), and you may object to processing
based on legitimate interests (Art. 21). Write to
[privacy@torwache.com](mailto:privacy@torwache.com).

You may also complain to a supervisory authority (Art. 77 GDPR). For this controller that is the
Berlin Commissioner for Data Protection and Freedom of Information.

Neither the extension nor the website uses automated decision-making or profiling.

## Changes and contact

Material policy changes will be published here and noted in the project changelog. General
questions can be raised through the repository's
[GitHub issues](https://github.com/alexgutjahr/torwache/issues). Issues are public, so do not put
anything private in one; use [privacy@torwache.com](mailto:privacy@torwache.com) instead.
