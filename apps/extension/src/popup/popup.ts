/**
 * Popup script. Renders the popup form, writes changes to
 * `chrome.storage.sync` via the typed wrapper, and pulls the current
 * tab's hostname for the "enabled on this site" toggle.
 *
 * The content script is the live consumer — it picks up storage changes
 * via onPrefsChanged and re-renders pills.
 */

import { charities } from '@price-to-impact/charities';
import { getPrefs, setPrefs } from '../storage';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`#${id} missing in popup.html`);
  return el as T;
};

async function currentTabHostname(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url === undefined) return null;
  try {
    return new URL(tab.url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function showStatus(text: string): void {
  const el = $<HTMLDivElement>('status');
  el.textContent = text;
  if (text === '') return;
  setTimeout(() => {
    if (el.textContent === text) el.textContent = '';
  }, 1200);
}

async function init(): Promise<void> {
  const prefs = await getPrefs();
  const hostname = await currentTabHostname();

  // Header icon = currently selected charity (visual confirmation).
  const charity = charities.find((c) => c.id === prefs.selectedCharityId) ?? charities[0];
  if (charity !== undefined) $<HTMLSpanElement>('header-icon').textContent = charity.icon;

  // Charity dropdown.
  const select = $<HTMLSelectElement>('charity');
  select.replaceChildren(
    ...charities.map((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon}  ${c.name}`;
      if (c.id === prefs.selectedCharityId) opt.selected = true;
      return opt;
    }),
  );
  select.addEventListener('change', async () => {
    const next = await setPrefs({ selectedCharityId: select.value });
    const picked = charities.find((c) => c.id === next.selectedCharityId);
    if (picked !== undefined) $<HTMLSpanElement>('header-icon').textContent = picked.icon;
    showStatus('Saved.');
  });

  // Pause toggle.
  const pausedToggle = $<HTMLInputElement>('paused');
  pausedToggle.checked = prefs.paused;
  pausedToggle.addEventListener('change', async () => {
    await setPrefs({ paused: pausedToggle.checked });
    showStatus(pausedToggle.checked ? 'Paused everywhere.' : 'Resumed.');
  });

  // Per-site toggle.
  const siteToggle = $<HTMLInputElement>('site-enabled');
  const siteHint = $<HTMLDivElement>('site-hint');
  if (hostname === null) {
    $<HTMLElement>('site-section').style.display = 'none';
  } else {
    siteHint.textContent = hostname;
    siteToggle.checked = !prefs.disabledHostnames.includes(hostname);
    siteToggle.addEventListener('change', async () => {
      const current = (await getPrefs()).disabledHostnames;
      const next = siteToggle.checked
        ? current.filter((h) => h !== hostname)
        : [...new Set([...current, hostname])];
      await setPrefs({ disabledHostnames: next });
      showStatus(siteToggle.checked ? `Enabled on ${hostname}` : `Disabled on ${hostname}`);
    });
  }

  // Options button.
  $<HTMLButtonElement>('options-link').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

void init();
