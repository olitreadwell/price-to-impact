import { parsePriceString } from '@price-to-impact/charities';
import type { DetectedPrice, Detector } from '../types';

/**
 * Amazon (.com) price detector.
 *
 * v1 scope is amazon.com only — prices there are always USD, so we don't
 * need FX conversion yet. Other Amazon locales (.co.uk, .de, .com.au) will
 * follow once a static FX table or live rates module lands.
 *
 * DOM strategy:
 * 1. Every `.a-price` element is a candidate (cart, product page, search
 *    results, "Buy together" widgets all share this class).
 * 2. The text content of `.a-offscreen` is the canonical price string
 *    ("$24.99") — it is hidden from sighted users but exists for screen
 *    readers and is the most stable parsing target.
 * 3. If `.a-offscreen` is missing, we stitch `.a-price-whole` and
 *    `.a-price-fraction` together as a fallback.
 */

const AMAZON_COM_HOSTNAME_RE = /(?:^|\.)amazon\.com$/;

function isAmazonComUrl(url: URL): boolean {
  return AMAZON_COM_HOSTNAME_RE.test(url.hostname);
}

function readPriceText(priceEl: Element): string | null {
  const offscreen = priceEl.querySelector('.a-offscreen');
  const offscreenText = offscreen?.textContent?.trim() ?? '';
  if (offscreenText !== '') return offscreenText;

  const whole = priceEl.querySelector('.a-price-whole')?.textContent?.trim() ?? '';
  const fraction = priceEl.querySelector('.a-price-fraction')?.textContent?.trim() ?? '';
  if (whole === '' && fraction === '') return null;
  return fraction === '' ? `$${whole}` : `$${whole.replace(/[.,]$/, '')}.${fraction}`;
}

export const amazonDetector: Detector = {
  id: 'amazon.com',
  matches: isAmazonComUrl,
  detect(root) {
    const results: DetectedPrice[] = [];
    for (const priceEl of root.querySelectorAll('.a-price')) {
      const text = readPriceText(priceEl);
      if (text === null) continue;
      const parsed = parsePriceString(text);
      if (parsed === null) continue;
      // TODO: FX conversion. For now, skip non-USD detections so amazon.de
      // running this bookmarklet won't produce silently wrong numbers.
      if (parsed.currency !== 'USD') continue;
      results.push({ priceUsd: parsed.amount, anchorEl: priceEl });
    }
    return results;
  },
};
