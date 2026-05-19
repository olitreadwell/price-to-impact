/**
 * Content script: runs on amazon.com page loads (and every navigation that
 * keeps the same tab), annotates every detected price with a charity-impact
 * pill, and re-runs on DOM mutations so dynamically-loaded prices (cart
 * updates, infinite-scroll product lists) stay annotated.
 */

import { charities, convertPrice, formatUnits } from '@price-to-impact/charities';
import { amazonDetector } from '@price-to-impact/bookmarklet/detectors/amazon';
import { clearPills, renderPill } from '@price-to-impact/bookmarklet/render';

const RENDER_DEBOUNCE_MS = 250;

const charity = charities[0];

function renderAll(): void {
  if (charity === undefined) return;
  if (!amazonDetector.matches(new URL(window.location.href))) return;
  clearPills(document.body);
  const prices = amazonDetector.detect(document.body);
  for (const { priceUsd, anchorEl } of prices) {
    const units = convertPrice(priceUsd, charity);
    renderPill(anchorEl, `${charity.icon} ≈ ${formatUnits(units, charity)}`);
  }
}

let observer: MutationObserver | null = null;

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

let scheduled: ReturnType<typeof setTimeout> | null = null;

function scheduleRender(): void {
  if (scheduled !== null) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    safeRender();
  }, RENDER_DEBOUNCE_MS);
}

// Initial render once content script wakes (manifest run_at: document_idle).
safeRender();

// Re-render on DOM mutations. We disconnect during render so our own pill
// insertions don't trigger the observer in a feedback loop.
observer = new MutationObserver(scheduleRender);
observer.observe(document.body, { childList: true, subtree: true });
