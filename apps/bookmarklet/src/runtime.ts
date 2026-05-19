import { charities, convertPrice, formatUnits } from '@price-to-impact/charities';
import { mockDetector } from './detectors/mock';
import { pickDetectorForUrl } from './detectors/registry';
import { clearPills, renderPill } from './render';

/**
 * Bookmarklet entry point. Idempotent: calling `run` twice replaces stale
 * pills rather than stacking duplicates.
 *
 * Detector selection: try the registry (Amazon, generic, etc.) first. If
 * nothing matches by URL, fall back to the mock detector — it only emits
 * on opt-in `data-p2i-mock-price` markers, so it's a no-op on real
 * sites and lets the web app preview itself.
 *
 * Charity: the bookmarklet is a single inline `javascript:` URL so it
 * has no access to `chrome.storage.sync`. Always uses `charities[0]`
 * (AMF). Users wanting a different charity should install the extension.
 */
export function run(): void {
  const url = new URL(window.location.href);
  const detector = pickDetectorForUrl(url) ?? mockDetector;

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
