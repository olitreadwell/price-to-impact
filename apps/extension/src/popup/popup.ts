/**
 * Popup script. Renders the popup form, writes changes to
 * `chrome.storage.sync` via the typed wrapper, and pulls the current
 * tab's hostname for the "enabled on this site" toggle.
 *
 * The content script is the live consumer — it picks up storage changes
 * via onPrefsChanged and re-renders pills.
 */

import { charities, type Charity } from '@price-to-impact/charities';
import { getPrefs, setPrefs } from '../storage';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`#${id} missing in popup.html`);
  return el as T;
};

function setHeaderIcon(charity: Charity | undefined): void {
  if (charity !== undefined) $<HTMLSpanElement>('header-icon').textContent = charity.icon;
}

function findCharity(id: string): Charity | undefined {
  return charities.find((c) => c.id === id) ?? charities[0];
}

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

function createCharityOption(c: Charity, isSelected: boolean): HTMLOptionElement {
  const opt = document.createElement('option');
  opt.value = c.id;
  opt.textContent = `${c.icon}  ${c.name}`;
  opt.selected = isSelected;
  return opt;
}

function withoutHost(hostnames: readonly string[], target: string): readonly string[] {
  return hostnames.filter((h) => h !== target);
}

function withHost(hostnames: readonly string[], target: string): readonly string[] {
  return hostnames.includes(target) ? hostnames : [...hostnames, target];
}

async function init(): Promise<void> {
  const prefs = await getPrefs();
  const hostname = await currentTabHostname();

  setHeaderIcon(findCharity(prefs.selectedCharityId));

  // Charity dropdown.
  const select = $<HTMLSelectElement>('charity');
  select.replaceChildren(
    ...charities.map((c) => createCharityOption(c, c.id === prefs.selectedCharityId)),
  );
  select.addEventListener('change', async () => {
    const next = await setPrefs({ selectedCharityId: select.value });
    setHeaderIcon(findCharity(next.selectedCharityId));
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
  if (hostname === null) {
    $<HTMLElement>('site-section').style.display = 'none';
  } else {
    $<HTMLDivElement>('site-hint').textContent = hostname;
    const siteToggle = $<HTMLInputElement>('site-enabled');
    siteToggle.checked = !prefs.disabledHostnames.includes(hostname);
    siteToggle.addEventListener('change', async () => {
      const current = (await getPrefs()).disabledHostnames;
      const next = siteToggle.checked ? withoutHost(current, hostname) : withHost(current, hostname);
      await setPrefs({ disabledHostnames: next });
      showStatus(siteToggle.checked ? `Enabled on ${hostname}` : `Disabled on ${hostname}`);
    });
  }

  $<HTMLButtonElement>('options-link').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

void init();
