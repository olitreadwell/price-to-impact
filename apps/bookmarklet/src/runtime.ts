import { charities, convertPrice, formatUnits } from '@price-to-impact/charities';
import { mockDetector } from './detectors/mock';
import { pickDetectorForUrl } from './detectors/registry';
import { clearPills, renderPill } from './render';
import type { Detector } from './types';

/**
 * Bookmarklet entry. The registry holds site-specific + generic
 * detectors; the mock detector is appended last so the "preview on the
 * web converter page" affordance still fires when `data-p2i-mock-price`
 * attributes are present.
 */
function pickDetector(url: URL): Detector | null {
  const registered = pickDetectorForUrl(url);
  if (registered !== null) return registered;
  return mockDetector.detect(document.body).length > 0 ? mockDetector : null;
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
    renderPill(anchorEl, {
      label: `${charity.icon} ≈ ${formatUnits(units, charity)}`,
      href: charity.donateUrl,
      title: `Donate to ${charity.name}`,
    });
  }
}
