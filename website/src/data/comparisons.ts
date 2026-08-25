export interface Comparison {
  slug: string;
  name: string;
  metaTitle: string;
  description: string;
  intro: string;
  shortAnswer: string;
  bestFor: string[];
  chooseTorwache: string[];
  rows: {
    label: string;
    torwache: string;
    competitor: string;
  }[];
  sources: {
    label: string;
    url: string;
  }[];
}

export const comparisonReview = {
  machineDate: '2026-08-25',
  label: 'August 25, 2026',
} as const;

const torwacheDefaults = {
  platform: 'Chrome, as a standalone extension.',
  blocking: 'A persistent list of domains. Each entry is either on or off.',
  schedules: 'None. No sessions, timers, allowances, or recurring schedules.',
  account: 'No account and no cloud sync.',
  analytics: 'None inside the extension.',
  privacy:
    'Local extension storage; no content scripts, host permissions, remote assets, or background network requests.',
  price: 'Free. No paid tier or trial.',
  source:
    'Open source; strict TypeScript is compiled by WXT into an inspectable browser-native package.',
};

export const comparisons: Comparison[] = [
  {
    slug: 'blocksite',
    name: 'BlockSite',
    metaTitle: 'torwache vs BlockSite: simple or full-featured?',
    description:
      'A factual torwache vs BlockSite comparison covering price, schedules, accounts, privacy, analytics, and blocking features.',
    intro:
      'BlockSite is a broad, multi-device productivity product. torwache is a deliberately narrow Chrome extension. The right choice depends on whether you want a system or a switch.',
    shortAnswer:
      'Choose BlockSite when you want schedules, focus sessions, categories, cross-device sync, and usage insights. Choose torwache when you only want a local domain list and do not want an account or productivity layer.',
    bestFor: [
      'Blocking sites and apps across more than one device',
      'Scheduled focus sessions and recurring routines',
      'Category, keyword, and password-protected blocking',
      'People who want usage insights and cross-device sync',
    ],
    chooseTorwache: [
      'You only need Chrome website blocking',
      'You prefer no account, cloud sync, or paid feature ladder',
      'You want no analytics or background network requests inside the extension',
      'You value a small, readable open-source codebase',
    ],
    rows: [
      {
        label: 'Platform',
        torwache: torwacheDefaults.platform,
        competitor: 'Browser, desktop, and mobile products are advertised.',
      },
      {
        label: 'Blocking model',
        torwache: torwacheDefaults.blocking,
        competitor: 'Sites, apps, categories, keywords, redirects, and focus modes.',
      },
      {
        label: 'Schedules',
        torwache: torwacheDefaults.schedules,
        competitor: 'Focus sessions, schedules, and automated routines are available.',
      },
      {
        label: 'Account & sync',
        torwache: torwacheDefaults.account,
        competitor: 'Cross-device sync is part of the broader product and premium offering.',
      },
      {
        label: 'Insights',
        torwache: torwacheDefaults.analytics,
        competitor: 'Browsing trends and productivity insights are advertised.',
      },
      {
        label: 'Data model',
        torwache: torwacheDefaults.privacy,
        competitor: 'A multi-platform service governed by BlockSite’s current privacy policy.',
      },
      {
        label: 'Price model',
        torwache: torwacheDefaults.price,
        competitor: 'Free installation with paid premium/lifetime features.',
      },
      { label: 'Source code', torwache: torwacheDefaults.source, competitor: 'Proprietary.' },
    ],
    sources: [
      {
        label: 'BlockSite feature overview',
        url: 'https://blocksite.co/productivity',
      },
      {
        label: 'BlockSite account and subscription terms',
        url: 'https://blocksite.co/terms',
      },
      { label: 'BlockSite privacy policy', url: 'https://blocksite.co/privacy' },
    ],
  },
  {
    slug: 'stayfocusd',
    name: 'StayFocusd',
    metaTitle: 'torwache vs StayFocusd: which Chrome blocker?',
    description:
      'Compare torwache and StayFocusd for Chrome: blocking approach, limits, schedules, analytics, permissions, privacy, and price.',
    intro:
      'StayFocusd manages how much time you spend on distracting sites. torwache makes a simpler decision: a domain is blocked until you switch it back on.',
    shortAnswer:
      'Choose StayFocusd for time allowances, active hours, usage analytics, in-page blocking, and a stricter “Nuclear Option.” Choose torwache for a smaller permission surface and a permanent, uncomplicated on/off blocklist.',
    bestFor: [
      'Daily time allowances instead of permanent blocking',
      'Active days, hours, and an irreversible Nuclear Option',
      'Usage charts and historical browsing insights',
      'Hiding distracting parts of sites such as recommendations or comments',
    ],
    chooseTorwache: [
      'A domain should either open or not open',
      'You do not want usage history or a productivity dashboard',
      'You do not want an extension that can read and change page content',
      'You prefer three narrowly explained permissions and no content scripts',
    ],
    rows: [
      {
        label: 'Platform',
        torwache: torwacheDefaults.platform,
        competitor: 'Chrome extension with broader browser and mobile connections advertised.',
      },
      {
        label: 'Blocking model',
        torwache: torwacheDefaults.blocking,
        competitor: 'Time limits, configurable URL/content blocking, and a Nuclear Option.',
      },
      {
        label: 'Schedules',
        torwache: torwacheDefaults.schedules,
        competitor: 'Active days and hours plus timed restrictions.',
      },
      {
        label: 'Account & sync',
        torwache: torwacheDefaults.account,
        competitor: 'Cross-device usage limits and mobile pairing are advertised.',
      },
      {
        label: 'Insights',
        torwache: torwacheDefaults.analytics,
        competitor: 'Website usage history, charts, and reports.',
      },
      {
        label: 'Permissions',
        torwache: torwacheDefaults.privacy,
        competitor:
          'Requests access to read and change data on visited sites; its listing explains why.',
      },
      {
        label: 'Price model',
        torwache: torwacheDefaults.price,
        competitor: 'Advertised as free.',
      },
      { label: 'Source code', torwache: torwacheDefaults.source, competitor: 'Proprietary.' },
    ],
    sources: [
      { label: 'StayFocusd official website', url: 'https://www.stayfocusd.com/' },
      {
        label: 'StayFocusd Chrome Web Store listing',
        url: 'https://chromewebstore.google.com/detail/stayfocusd-%E2%80%93-website-bloc/laankejkbhbdhmipfmgcngdelahlfoji',
      },
    ],
  },
  {
    slug: 'cold-turkey',
    name: 'Cold Turkey Blocker',
    metaTitle: 'torwache vs Cold Turkey Blocker',
    description:
      'Compare torwache with Cold Turkey Blocker for websites, apps, schedules, locked blocks, local data, supported platforms, and pricing.',
    intro:
      'Cold Turkey is a desktop enforcement tool built to make blocks difficult to escape. torwache is a lightweight Chrome extension built to keep blocking understandable.',
    shortAnswer:
      'Choose Cold Turkey when you need hard-to-bypass scheduled blocks across websites, applications, or the whole computer. Choose torwache when a simple Chrome blocklist is enough and you do not need desktop-level enforcement.',
    bestFor: [
      'Blocking both desktop applications and websites',
      'Locked schedules that resist uninstalling or changing settings',
      'Pomodoro breaks, allowances, rewards, and detailed strictness controls',
      'Windows and macOS users who need system-level enforcement',
    ],
    chooseTorwache: [
      'You need a small Chrome-only tool',
      'You want no separately installed desktop application or service',
      'You prefer a persistent list over schedules and lock mechanisms',
      'You want the complete source code available to inspect',
    ],
    rows: [
      {
        label: 'Platform',
        torwache: torwacheDefaults.platform,
        competitor: 'Windows and macOS desktop software with browser integration.',
      },
      {
        label: 'Blocking model',
        torwache: torwacheDefaults.blocking,
        competitor:
          'Websites, apps, the internet, and device actions with extensive strictness controls.',
      },
      {
        label: 'Schedules',
        torwache: torwacheDefaults.schedules,
        competitor: 'Recurring schedules, timers, locks, breaks, allowances, and rewards.',
      },
      {
        label: 'Account & sync',
        torwache: torwacheDefaults.account,
        competitor: 'Desktop-focused; settings and statistics are described as locally stored.',
      },
      {
        label: 'Insights',
        torwache: torwacheDefaults.analytics,
        competitor: 'Local visit statistics with export and deletion controls.',
      },
      {
        label: 'Data model',
        torwache: torwacheDefaults.privacy,
        competitor: 'Settings and statistics are described as local to the computer.',
      },
      {
        label: 'Price model',
        torwache: torwacheDefaults.price,
        competitor: 'Free basic blocker; paid Pro is a lifetime purchase.',
      },
      { label: 'Source code', torwache: torwacheDefaults.source, competitor: 'Proprietary.' },
    ],
    sources: [
      { label: 'Cold Turkey feature overview', url: 'https://getcoldturkey.com/features/' },
      { label: 'Cold Turkey pricing', url: 'https://getcoldturkey.com/pricing/' },
    ],
  },
  {
    slug: 'freedom',
    name: 'Freedom',
    metaTitle: 'torwache vs Freedom: browser extension or focus system?',
    description:
      'A practical comparison of torwache and Freedom covering devices, sessions, locked mode, accounts, sync, analytics, and pricing.',
    intro:
      'Freedom coordinates focus sessions across computers and phones. torwache stays inside Chrome and stores one local list. They solve different sizes of the same problem.',
    shortAnswer:
      'Choose Freedom for synchronized sessions across Mac, Windows, iOS, Android, and ChromeOS. Choose torwache when you only need Chrome and would rather avoid accounts, sessions, subscriptions, and cloud coordination.',
    bestFor: [
      'Blocking sites and apps across computers and phones',
      'Synchronized and recurring focus sessions',
      'Locked Mode and whole-internet blocking',
      'People who want session history and ambient focus sounds',
    ],
    chooseTorwache: [
      'Chrome is the only place you need to block sites',
      'You do not want to create an account',
      'You want a permanent list rather than timed sessions',
      'You prefer free, open-source software with no background network service',
    ],
    rows: [
      {
        label: 'Platform',
        torwache: torwacheDefaults.platform,
        competitor: 'Mac, Windows, iOS, Android, and ChromeOS are supported.',
      },
      {
        label: 'Blocking model',
        torwache: torwacheDefaults.blocking,
        competitor: 'Session-based site, app, and whole-internet blocking.',
      },
      {
        label: 'Schedules',
        torwache: torwacheDefaults.schedules,
        competitor: 'Start-now, future, recurring, and Locked Mode sessions.',
      },
      {
        label: 'Account & sync',
        torwache: torwacheDefaults.account,
        competitor: 'An account coordinates blocklists, sessions, and devices.',
      },
      {
        label: 'Insights',
        torwache: torwacheDefaults.analytics,
        competitor: 'Session history and annotations are advertised.',
      },
      {
        label: 'Data model',
        torwache: torwacheDefaults.privacy,
        competitor: 'A multi-device service with dashboard and synchronization.',
      },
      {
        label: 'Price model',
        torwache: torwacheDefaults.price,
        competitor:
          'Free tier plus monthly, annual, and lifetime paid plans; annual Premium offers a seven-day trial.',
      },
      { label: 'Source code', torwache: torwacheDefaults.source, competitor: 'Proprietary.' },
    ],
    sources: [
      { label: 'Freedom feature overview', url: 'https://freedom.to/features' },
      { label: 'Freedom pricing', url: 'https://freedom.to/premium' },
      {
        label: 'Freedom getting-started guide',
        url: 'https://support.freedom.to/en/articles/4385673-how-to-get-started-with-freedom',
      },
      {
        label: 'Freedom Locked Mode documentation',
        url: 'https://support.freedom.to/en/articles/1802927-locked-mode',
      },
    ],
  },
];
