import type { DetectedPrice, Detector } from '../types';

/**
 * Mock detector used during visual development of the bookmarklet pipeline.
 *
 * Looks for elements with a `data-p2i-mock-price="<usd>"` attribute and
 * emits each one as a price, anchored to the element itself. Lets the
 * render + integration layers be exercised end-to-end before the real
 * Amazon detector ships.
 */
export const mockDetector: Detector = {
  id: 'mock',
  matches: () => true,
  detect(root) {
    const candidates = root.querySelectorAll('[data-p2i-mock-price]');
    const results: DetectedPrice[] = [];
    for (const el of candidates) {
      const raw = el.getAttribute('data-p2i-mock-price');
      const num = raw === null ? Number.NaN : Number(raw);
      if (Number.isFinite(num) && num > 0) {
        results.push({ priceUsd: num, anchorEl: el });
      }
    }
    return results;
  },
};
