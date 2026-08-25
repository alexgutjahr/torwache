import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

export default defineUnlistedScript(() => {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem('theme');
  } catch {
    // The system theme is a safe fallback when localStorage is unavailable.
  }
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved;
  }
});
