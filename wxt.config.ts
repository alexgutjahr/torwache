import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'extension',
  publicDir: 'extension/public',
  manifestVersion: 3,
  manifest: {
    name: 'torwache',
    description:
      'Simple website blocker. Blocks the sites on your list and nothing else. No telemetry, no accounts, no cloud sync.',
    minimum_chrome_version: '123',
    homepage_url: 'https://torwache.com/',
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    incognito: 'spanning',
    permissions: ['storage', 'declarativeNetRequest', 'webNavigation'],
    action: {
      default_title: 'torwache',
      default_icon: {
        16: '/icons/icon16.png',
        32: '/icons/icon32.png',
      },
    },
    icons: {
      16: '/icons/icon16.png',
      32: '/icons/icon32.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
  },
  webExt: {
    chromiumArgs: [
      '--user-data-dir=.wxt/chrome-data',
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
    ],
  },
  vite: () => ({
    build: {
      // Chrome 123+ supports modulepreload. Omitting Vite's fallback keeps the
      // extension bundle free of its otherwise-unnecessary fetch() polyfill.
      modulePreload: { polyfill: false },
    },
    plugins: [tailwindcss()],
  }),
});
