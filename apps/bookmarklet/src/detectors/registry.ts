import type { Detector } from '../types';
import { amazonDetector } from './amazon';
import { genericDetector } from './generic';

/**
 * Ordered registry of price detectors.
 *
 * Lookup is first-match-wins, so put high-precision site-specific
 * detectors early and the broad generic regex detector last. Each
 * detector decides whether it should run via `matches(url)`.
 *
 * To add a new site:
 *   1. Create `src/detectors/<site>.ts` exporting a `Detector`.
 *   2. Insert it above `genericDetector` in this array.
 *   3. Add tests; the contract is documented in `../types.ts`.
 *
 * The mock detector is *not* registered here — it ships separately
 * for the bookmarklet's "preview on the web converter" affordance.
 */
export const detectors: readonly Detector[] = [amazonDetector, genericDetector];

/** Return the first detector whose `matches(url)` is true, or null. */
export function pickDetectorForUrl(url: URL): Detector | null {
  for (const d of detectors) {
    if (d.matches(url)) return d;
  }
  return null;
}
