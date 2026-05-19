/**
 * Options page script. Two stateful controls:
 *   1. Charity radio list — write `selectedCharityId` on change.
 *   2. Disabled sites — list with per-row "Remove" button.
 *
 * The popup handles day-to-day controls (pause, per-current-tab toggle).
 * This page is for less-frequent tweaks: changing default charity,
 * undoing a stale per-site disable, and reading provenance.
 */

import { charities } from '@price-to-impact/charities';
import { getPrefs, onPrefsChanged, setPrefs, type Prefs } from '../storage';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`#${id} missing in options.html`);
  return el as T;
};

function showStatus(text: string): void {
  const el = $<HTMLDivElement>('status');
  el.textContent = text;
  setTimeout(() => {
    if (el.textContent === text) el.textContent = '';
  }, 1500);
}

function renderCharityList(prefs: Prefs): void {
  const container = $<HTMLDivElement>('charity-list');
  container.replaceChildren(
    ...charities.map((c) => {
      const row = document.createElement('label');
      row.className = 'charity-row';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'charity';
      radio.value = c.id;
      radio.checked = c.id === prefs.selectedCharityId;
      radio.addEventListener('change', async () => {
        if (!radio.checked) return;
        await setPrefs({ selectedCharityId: c.id });
        $<HTMLSpanElement>('header-icon').textContent = c.icon;
        showStatus(`Default charity set to ${c.name}.`);
      });
      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.textContent = c.icon;
      const meta = document.createElement('div');
      meta.className = 'meta';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = c.name;
      const cost = document.createElement('div');
      cost.className = 'cost';
      cost.textContent = `$${c.costPerUnitUsd.toFixed(2)} per ${c.unit}`;
      const source = document.createElement('div');
      source.className = 'source';
      source.textContent = `Source: ${c.source} (as of ${c.asOf})`;
      meta.append(name, cost, source);
      row.append(radio, icon, meta);
      return row;
    }),
  );
}

function renderSitesList(prefs: Prefs): void {
  const ul = $<HTMLUListElement>('sites-list');
  if (prefs.disabledHostnames.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No sites are currently disabled.';
    ul.replaceChildren(empty);
    return;
  }
  ul.replaceChildren(
    ...prefs.disabledHostnames.map((hostname) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = hostname;
      const remove = document.createElement('button');
      remove.className = 'remove';
      remove.type = 'button';
      remove.textContent = 'Re-enable';
      remove.addEventListener('click', async () => {
        const current = (await getPrefs()).disabledHostnames;
        await setPrefs({ disabledHostnames: current.filter((h) => h !== hostname) });
        showStatus(`Re-enabled on ${hostname}.`);
      });
      li.append(label, remove);
      return li;
    }),
  );
}

async function init(): Promise<void> {
  const prefs = await getPrefs();
  const charity = charities.find((c) => c.id === prefs.selectedCharityId) ?? charities[0];
  if (charity !== undefined) $<HTMLSpanElement>('header-icon').textContent = charity.icon;

  renderCharityList(prefs);
  renderSitesList(prefs);

  // Re-render on cross-tab changes so the popup and options page stay
  // in sync if both are open.
  onPrefsChanged((next) => {
    renderCharityList(next);
    renderSitesList(next);
  });
}

void init();
