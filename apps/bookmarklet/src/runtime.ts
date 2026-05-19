import { charities, convertPrice, formatUnits } from '@price-to-impact/charities';
import { amazonDetector } from './detectors/amazon';
import { mockDetector } from './detectors/mock';
import { clearPills, renderPill } from './render';
import type { Detector } from './types';

/**
 * Ordered list of detectors. The first one that matches the current URL wins.
 * The mock detector is last as a development fallback — it matches any URL
 * but only fires when the page contains opt-in `data-p2i-mock-price`
 * attributes, so it is harmless on real sites.
 */
const DETECTORS: readonly Detector[] = [amazonDetector, mockDetector];

function pickDetector(url: URL): Detector | null {
  for (const detector of DETECTORS) {
    if (detector.matches(url)) return detector;
  }
  return null;
}

/**
 * Bookmarklet entry point. Idempotent: calling `run` twice replaces stale
 * pills rather than stacking duplicates.
 */
export function run(): void {
  const detector = pickDetector(new URL(window.location.href));
  if (detector === null) return;

  const charity = charities[0];
  if (charity === undefined) return;

  clearPills(document.body);
  const prices = detector.detect(document.body);

  for (const { priceUsd, anchorEl } of prices) {
    const units = convertPrice(priceUsd, charity);
    const label = `${charity.icon} ≈ ${formatUnits(units, charity)}`;
    renderPill(anchorEl, label);
  }
}
