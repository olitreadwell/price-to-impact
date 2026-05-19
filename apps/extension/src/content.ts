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
 *
 * Storage changes are picked up live — toggle in the popup, the content
 * script re-renders immediately.
 */

import { charities, convertPrice, formatUnits } from '@price-to-impact/charities';
import { amazonDetector } from '@price-to-impact/bookmarklet/detectors/amazon';
import { clearPills, renderPill } from '@price-to-impact/bookmarklet/render';
import { DEFAULT_PREFS, getPrefs, onPrefsChanged, type Prefs } from './storage';

const RENDER_DEBOUNCE_MS = 250;

let currentPrefs: Prefs = DEFAULT_PREFS;
let observer: MutationObserver | null = null;
let scheduled: ReturnType<typeof setTimeout> | null = null;

function shouldRunHere(prefs: Prefs): boolean {
  if (prefs.paused) return false;
  // window.location.hostname is already lowercase per WHATWG URL.
  if (prefs.disabledHostnames.includes(window.location.hostname)) return false;
  if (!amazonDetector.matches(new URL(window.location.href))) return false;
  return true;
}

function renderAll(): void {
  if (document.body === null) return;
  // Clear before the gate, not after: toggling pause / per-site disable
  // should remove existing pills, not leave them stale.
  clearPills(document.body);
  if (!shouldRunHere(currentPrefs)) return;

  const charity =
    charities.find((c) => c.id === currentPrefs.selectedCharityId) ?? charities[0];
  if (charity === undefined) return;

  const prices = amazonDetector.detect(document.body);
  for (const { priceUsd, anchorEl } of prices) {
    const units = convertPrice(priceUsd, charity);
    renderPill(anchorEl, {
      label: `${charity.icon} ≈ ${formatUnits(units, charity)}`,
      href: charity.donateUrl,
      title: `Donate to ${charity.name}`,
    });
  }
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
}

void boot();
