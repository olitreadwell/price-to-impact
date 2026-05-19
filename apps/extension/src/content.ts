/**
 * Content script: runs on every load of a configured Amazon TLD,
 * annotates every detected price with a charity-impact pill, and
 * re-runs on DOM mutations so dynamically-loaded prices (cart updates,
 * infinite scroll) stay annotated.
 *
 * Behaviour is controlled by chrome.storage.sync via the typed wrapper
 * in ./storage:
 *   - selectedCharityId: which charity's icon + math drive the pill
 *   - paused: global kill switch
 *   - disabledHostnames: per-site disable
 *   - roundupCents + activeThresholdCents: drive the round-up jar
 *
 * Round-up: every newly-rendered price contributes `jarContribution`
 * cents to the jar. When the jar reaches the active threshold, each
 * pill decorates with `🎯` and its href changes to a 1-click donation
 * of the threshold amount. Clicking the decorated pill decrements
 * the jar (carrying remainder) before navigation.
 *
 * Storage changes are picked up live — toggle in the popup, the content
 * script re-renders immediately.
 */

import {
  charities,
  convertPrice,
  donateUrlForAmount,
  formatUnits,
  jarContribution,
  thresholdState,
  type Charity,
} from '@price-to-impact/charities';
import { amazonDetector } from '@price-to-impact/bookmarklet/detectors/amazon';
import { clearPills, renderPill } from '@price-to-impact/bookmarklet/render';
import { DEFAULT_PREFS, getPrefs, onPrefsChanged, setPrefs, type Prefs } from './storage';

const RENDER_DEBOUNCE_MS = 250;
const THRESHOLD_DATA_ATTR = 'data-p2i-threshold-cents';

let currentPrefs: Prefs = DEFAULT_PREFS;
let observer: MutationObserver | null = null;
let scheduled: ReturnType<typeof setTimeout> | null = null;

/**
 * Anchors that have already contributed to the jar in this content
 * script's lifetime. Per-page-load WeakSet so a MutationObserver tick
 * that re-encounters the same `.a-price` element doesn't double-count.
 * GC'd along with the document.
 */
const countedAnchors = new WeakSet<Element>();

function shouldRunHere(prefs: Prefs): boolean {
  if (prefs.paused) return false;
  // window.location.hostname is already lowercase per WHATWG URL.
  if (prefs.disabledHostnames.includes(window.location.hostname)) return false;
  if (!amazonDetector.matches(new URL(window.location.href))) return false;
  return true;
}

function findCharity(id: string): Charity | undefined {
  return charities.find((c) => c.id === id) ?? charities[0];
}

function bumpJarBy(cents: number): void {
  if (cents <= 0) return;
  // Fire-and-forget — the storage write is async and we don't gate
  // pill rendering on it. onPrefsChanged will surface the new value.
  void setPrefs({ roundupCents: currentPrefs.roundupCents + cents });
}

function renderAll(): void {
  if (document.body === null) return;
  // Clear before the gate, not after: toggling pause / per-site disable
  // should remove existing pills, not leave them stale.
  clearPills(document.body);
  if (!shouldRunHere(currentPrefs)) return;

  const charity = findCharity(currentPrefs.selectedCharityId);
  if (charity === undefined) return;

  const prices = amazonDetector.detect(document.body);
  const state = thresholdState(currentPrefs.roundupCents, currentPrefs.activeThresholdCents);
  let contribution = 0;

  for (const { priceUsd, anchorEl } of prices) {
    if (!countedAnchors.has(anchorEl)) {
      countedAnchors.add(anchorEl);
      contribution += jarContribution(priceUsd);
    }
    renderOnePill({ priceUsd, anchorEl, charity, thresholdMet: state.reachedThreshold });
  }

  bumpJarBy(contribution);
}

interface RenderOnePillArgs {
  readonly priceUsd: number;
  readonly anchorEl: Element;
  readonly charity: Charity;
  readonly thresholdMet: boolean;
}

function renderOnePill({ priceUsd, anchorEl, charity, thresholdMet }: RenderOnePillArgs): void {
  const units = convertPrice(priceUsd, charity);

  if (thresholdMet) {
    const thresholdUsd = currentPrefs.activeThresholdCents / 100;
    renderPill(anchorEl, {
      label: `🎯 ${charity.icon} Donate $${thresholdUsd.toFixed(0)} → ${formatUnits(units, charity)} from this price`,
      href: donateUrlForAmount(charity, thresholdUsd),
      title: `Round-up jar full — 1-click donate $${thresholdUsd.toFixed(2)} to ${charity.name}`,
    });
    // Tag the newly-inserted pill so the click handler can decrement
    // the jar by the right amount before the browser navigates away.
    const pill = anchorEl.nextElementSibling;
    if (pill instanceof HTMLAnchorElement) {
      pill.setAttribute(THRESHOLD_DATA_ATTR, String(currentPrefs.activeThresholdCents));
    }
  } else {
    renderPill(anchorEl, {
      label: `${charity.icon} ≈ ${formatUnits(units, charity)}`,
      href: donateUrlForAmount(charity, priceUsd),
      title: `Donate $${priceUsd.toFixed(2)} to ${charity.name}`,
    });
  }
}

/**
 * Delegated click handler on document.body — fires for any pill click
 * regardless of which detector rendered it. When the pill is in
 * threshold-met state, decrement the jar by the threshold amount
 * before the browser follows the anchor's href. Storage writes are
 * fire-and-forget; Chrome lets the chrome.storage write complete
 * even as the page navigates away.
 */
function handlePillClick(e: Event): void {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const pill = target.closest<HTMLAnchorElement>(`a[${THRESHOLD_DATA_ATTR}]`);
  if (pill === null) return;
  const cents = Number(pill.getAttribute(THRESHOLD_DATA_ATTR));
  if (!Number.isFinite(cents) || cents <= 0) return;
  const { remainderAfter } = thresholdState(currentPrefs.roundupCents, cents);
  void setPrefs({ roundupCents: remainderAfter });
}

function safeRender(): void {
  if (document.body === null) return;
  observer?.disconnect();
  try {
    renderAll();
  } finally {
    if (observer !== null && document.body !== null) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
}

function scheduleRender(): void {
  if (scheduled !== null) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    safeRender();
  }, RENDER_DEBOUNCE_MS);
}

async function boot(): Promise<void> {
  // Storage may be unavailable mid-reinstall or in an unusual profile —
  // fall back to defaults rather than aborting the whole content script.
  try {
    currentPrefs = await getPrefs();
  } catch (err) {
    console.warn('[price-to-impact] failed to read prefs, using defaults:', err);
    currentPrefs = DEFAULT_PREFS;
  }

  if (document.body === null) return;

  // Initial render once the content script wakes (document_idle).
  safeRender();

  // Re-render on DOM mutations (Amazon's client-side updates).
  observer = new MutationObserver(scheduleRender);
  observer.observe(document.body, { childList: true, subtree: true });

  // Re-render whenever the user changes prefs in the popup or options.
  onPrefsChanged((next) => {
    currentPrefs = next;
    safeRender();
  });

  // One listener for the lifetime of the page handles every pill click.
  document.addEventListener('click', handlePillClick, true);
}

void boot();
