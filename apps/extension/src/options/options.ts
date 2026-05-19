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
  type HistoryEntry,
  type Prefs,
  type ThresholdCents,
} from '../storage';

const HISTORY_VISIBLE = 50;

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

  const costId = `charity-cost-${c.id}`;
  const sourceId = `charity-source-${c.id}`;

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'charity';
  radio.value = c.id;
  radio.checked = isSelected;
  radio.setAttribute('aria-describedby', `${costId} ${sourceId}`);
  radio.addEventListener('change', async () => {
    if (!radio.checked) return;
    await setPrefs({ selectedCharityId: c.id });
    $<HTMLSpanElement>('header-icon').textContent = c.icon;
    showStatus(`Default charity set to ${c.name}.`);
  });

  const meta = document.createElement('div');
  meta.className = 'meta';
  const costEl = div('cost', `$${c.costPerUnitUsd.toFixed(2)} per ${c.unit}`);
  costEl.id = costId;
  const sourceEl = div('source', `Source: ${c.source} (as of ${c.asOf})`);
  sourceEl.id = sourceId;
  meta.append(div('name', c.name), costEl, sourceEl);

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function charityNameById(id: string): string {
  return charities.find((c) => c.id === id)?.name ?? id;
}

function renderHistory(prefs: Prefs): void {
  const total = prefs.history.reduce((sum, e) => sum + e.usd, 0);
  $<HTMLDivElement>('history-total').textContent =
    `Total intended: $${total.toFixed(2)} across ${prefs.history.length} ${prefs.history.length === 1 ? 'donation' : 'donations'}.`;

  const container = $<HTMLDivElement>('history-table');
  if (prefs.history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No donations clicked yet.';
    container.replaceChildren(empty);
    return;
  }

  const recent: readonly HistoryEntry[] = prefs.history
    .slice(-HISTORY_VISIBLE)
    .reverse();

  const table = document.createElement('table');
  table.className = 'history';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const text of ['Date', 'Amount', 'Charity', 'Source']) {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  for (const entry of recent) {
    const tr = document.createElement('tr');

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(entry.ts);
    const amountCell = document.createElement('td');
    amountCell.className = 'amount';
    amountCell.textContent = `$${entry.usd.toFixed(2)}`;
    const charityCell = document.createElement('td');
    charityCell.textContent = charityNameById(entry.charityId);
    const srcCell = document.createElement('td');
    srcCell.textContent = entry.srcHost;

    tr.append(dateCell, amountCell, charityCell, srcCell);
    tbody.append(tr);
  }
  table.append(tbody);

  container.replaceChildren(table);
}

async function init(): Promise<void> {
  const prefs = await getPrefs();
  const charity = charities.find((c) => c.id === prefs.selectedCharityId) ?? charities[0];
  if (charity !== undefined) $<HTMLSpanElement>('header-icon').textContent = charity.icon;

  renderCharityList(prefs);
  renderThresholdList(prefs);
  renderSitesList(prefs);
  renderHistory(prefs);

  // Re-render on cross-tab changes so the popup and options page stay
  // in sync if both are open.
  onPrefsChanged((next) => {
    renderCharityList(next);
    renderThresholdList(next);
    renderSitesList(next);
    renderHistory(next);
  });

  $<HTMLButtonElement>('history-clear').addEventListener('click', async () => {
    if (!window.confirm('Clear all donation history? This cannot be undone.')) return;
    await setPrefs({ history: [] });
    showStatus('History cleared.');
  });

  const intentToggle = $<HTMLInputElement>('purchase-intent-toggle');
  intentToggle.checked = prefs.purchaseIntentEnabled;
  intentToggle.addEventListener('change', async () => {
    await setPrefs({ purchaseIntentEnabled: intentToggle.checked });
    showStatus(
      intentToggle.checked
        ? 'Will prompt on Add to Cart / Buy Now.'
        : 'Purchase prompt disabled.',
    );
  });
}

void init();
