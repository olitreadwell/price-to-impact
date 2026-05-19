/**
 * Options page script. Two stateful controls:
 *   1. Charity radio list — write `selectedCharityId` on change.
 *   2. Disabled sites — list with per-row "Remove" button.
 *
 * The popup handles day-to-day controls (pause, per-current-tab toggle).
 * This page is for less-frequent tweaks: changing default charity,
 * undoing a stale per-site disable, and reading provenance.
 */

import { charities, type Charity } from '@price-to-impact/charities';
import {
  getPrefs,
  onPrefsChanged,
  setPrefs,
  THRESHOLDS_CENTS,
  type Prefs,
  type ThresholdCents,
} from '../storage';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`#${id} missing in options.html`);
  return el as T;
};

function div(className: string, text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

function showStatus(text: string): void {
  const el = $<HTMLDivElement>('status');
  el.textContent = text;
  setTimeout(() => {
    if (el.textContent === text) el.textContent = '';
  }, 1500);
}

function createCharityRow(c: Charity, isSelected: boolean): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'charity-row';

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'charity';
  radio.value = c.id;
  radio.checked = isSelected;
  radio.addEventListener('change', async () => {
    if (!radio.checked) return;
    await setPrefs({ selectedCharityId: c.id });
    $<HTMLSpanElement>('header-icon').textContent = c.icon;
    showStatus(`Default charity set to ${c.name}.`);
  });

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.append(
    div('name', c.name),
    div('cost', `$${c.costPerUnitUsd.toFixed(2)} per ${c.unit}`),
    div('source', `Source: ${c.source} (as of ${c.asOf})`),
  );

  row.append(radio, div('icon', c.icon), meta);
  return row;
}

function renderCharityList(prefs: Prefs): void {
  $<HTMLDivElement>('charity-list').replaceChildren(
    ...charities.map((c) => createCharityRow(c, c.id === prefs.selectedCharityId)),
  );
}

function createSiteRow(hostname: string): HTMLLIElement {
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
}

function emptySitesRow(): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = 'No sites are currently disabled.';
  return li;
}

function renderSitesList(prefs: Prefs): void {
  const ul = $<HTMLUListElement>('sites-list');
  if (prefs.disabledHostnames.length === 0) {
    ul.replaceChildren(emptySitesRow());
    return;
  }
  ul.replaceChildren(...prefs.disabledHostnames.map(createSiteRow));
}

function createThresholdRow(
  cents: ThresholdCents,
  isSelected: boolean,
): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'charity-row';

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'threshold';
  radio.value = String(cents);
  radio.checked = isSelected;
  radio.addEventListener('change', async () => {
    if (!radio.checked) return;
    await setPrefs({ activeThresholdCents: cents });
    showStatus(`Round-up threshold set to $${(cents / 100).toFixed(0)}.`);
  });

  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = `$${(cents / 100).toFixed(0)}`;
  meta.append(name);

  row.append(radio, meta);
  return row;
}

function renderThresholdList(prefs: Prefs): void {
  $<HTMLDivElement>('threshold-list').replaceChildren(
    ...THRESHOLDS_CENTS.map((c) => createThresholdRow(c, c === prefs.activeThresholdCents)),
  );
}

async function init(): Promise<void> {
  const prefs = await getPrefs();
  const charity = charities.find((c) => c.id === prefs.selectedCharityId) ?? charities[0];
  if (charity !== undefined) $<HTMLSpanElement>('header-icon').textContent = charity.icon;

  renderCharityList(prefs);
  renderThresholdList(prefs);
  renderSitesList(prefs);

  // Re-render on cross-tab changes so the popup and options page stay
  // in sync if both are open.
  onPrefsChanged((next) => {
    renderCharityList(next);
    renderThresholdList(next);
    renderSitesList(next);
  });
}

void init();
