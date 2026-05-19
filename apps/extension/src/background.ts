/**
 * MV3 service worker.
 *
 * Currently does nothing observable — it exists so that the extension
 * has a registered service worker (which Chrome uses to expose the
 * extension to debugging tools like Playwright) and so that future
 * event-driven code (install onboarding, schedule alarms, etc.) has
 * an obvious place to live.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[price-to-impact] installed');
  }
});

export {};
