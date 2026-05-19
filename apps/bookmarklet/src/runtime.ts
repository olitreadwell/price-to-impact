import {
  charities,
  convertPrice,
  donateUrlForAmount,
  formatUnits,
  type Charity,
} from '@price-to-impact/charities';
import { genericDetector } from './detectors/generic';
import { mockDetector } from './detectors/mock';
import { pickDetectorForUrl } from './detectors/registry';
import { clearPills, renderPill } from './render';
import type { DetectedPrice, Detector } from './types';

/**
 * Bookmarklet entry point. Idempotent: calling `run` twice replaces stale
 * pills rather than stacking duplicates.
 *
 * Detector selection: try the registry first (Amazon today, more later).
 * If nothing matches by URL, fall through to the generic regex detector;
 * if that finds nothing, try the mock detector (the web-app demo-prices
 * affordance). Each fallback runs detect() only when the previous one
 * returned zero results.
 *
 * Charity: the bookmarklet is a single inline `javascript:` URL so it has
 * no access to chrome.storage.sync. Always uses charities[0] (AMF).
 * Users wanting a different charity should install the extension.
 */
function renderResults(prices: readonly DetectedPrice[], charity: Charity): boolean {
  if (prices.length === 0) return false;
  for (const { priceUsd, anchorEl } of prices) {
    const units = convertPrice(priceUsd, charity);
    const unitsLabel = formatUnits(units, charity);
    renderPill(anchorEl, {
      label: `${charity.icon} ≈ ${unitsLabel}`,
      href: donateUrlForAmount(charity, priceUsd),
      title: `Donate $${priceUsd.toFixed(2)} to ${charity.name}`,
      card: {
        title: `${charity.icon} ${charity.name}`,
        subtitle: `$${priceUsd.toFixed(2)} ≈ ${unitsLabel}`,
        meta: [`$${charity.costPerUnitUsd.toFixed(2)} per ${charity.unit} · as of ${charity.asOf}`],
        cta: `Click to donate $${priceUsd.toFixed(2)} →`,
      },
    });
  }
  return true;
}

function detectWith(detector: Detector): readonly DetectedPrice[] {
  return detector.detect(document.body);
}

export function run(): void {
  const charity = charities[0];
  if (charity === undefined) return;

  clearPills(document.body);

  const registered = pickDetectorForUrl(new URL(window.location.href));
  if (registered !== null) {
    renderResults(detectWith(registered), charity);
    return;
  }

  // No site-specific match. Try generic first, then mock for the
  // web-app demo affordance.
  if (renderResults(detectWith(genericDetector), charity)) return;
  renderResults(detectWith(mockDetector), charity);
}
