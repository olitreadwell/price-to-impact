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
  const hostname = window.location.hostname.toLowerCase();
  if (prefs.disabledHostnames.includes(hostname)) return false;
  if (!amazonDetector.matches(new URL(window.location.href))) return false;
  return true;
}

function renderAll(): void {
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
  observer?.disconnect();
  try {
    renderAll();
  } finally {
    if (observer !== null) {
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
  currentPrefs = await getPrefs();

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
