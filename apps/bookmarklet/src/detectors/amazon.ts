import { parsePriceString, toUsd, type Currency } from '@price-to-impact/charities';
import type { DetectedPrice, Detector } from '../types';

/**
 * Amazon price detector — works across Amazon's locale TLDs.
 *
 * DOM strategy:
 * 1. Every `.a-price` element is a candidate (cart, product page, search
 *    results, "Buy together" widgets all share this class).
 * 2. The text content of `.a-offscreen` is the canonical price string
 *    ("$24.99", "£24.99", "AU$24.99") — hidden from sighted users but
 *    present for screen readers and the most stable parsing target.
 * 3. If `.a-offscreen` is missing, we stitch `.a-price-whole` and
 *    `.a-price-fraction` together as a fallback.
 *
 * Currency strategy:
 * - We map each supported Amazon TLD to its native currency.
 * - parsePriceString tries to read the currency from the text itself.
 * - When the text uses a bare `$` (which the parser defaults to USD),
 *   we override with the TLD's currency — amazon.com.au shows `$24.99`
 *   but it's really AUD, not USD.
 * - Explicit non-`$` symbols (`£`, `€`, `AU$`, etc.) trust the text.
 * - The result is finally converted to USD via the static FX table so
 *   the contract stays `{ priceUsd, anchorEl }`.
 */

const TLD_TO_CURRENCY: Readonly<Record<string, Currency>> = {
  'amazon.com': 'USD',
  'amazon.ca': 'CAD',
  'amazon.com.au': 'AUD',
  'amazon.co.uk': 'GBP',
  'amazon.de': 'EUR',
  'amazon.fr': 'EUR',
  'amazon.it': 'EUR',
  'amazon.es': 'EUR',
  'amazon.nl': 'EUR',
};

function hostnameToCurrency(hostname: string): Currency | null {
  // Defensive lowercase — WHATWG URL.hostname is already lowercase, but
  // callers may pass arbitrary strings (e.g. from manifest-style hosts).
  const lower = hostname.toLowerCase();
  for (const [suffix, currency] of Object.entries(TLD_TO_CURRENCY)) {
    if (lower === suffix || lower.endsWith(`.${suffix}`)) return currency;
  }
  return null;
}

function isAmazonUrl(url: URL): boolean {
  return hostnameToCurrency(url.hostname) !== null;
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

/**
 * Skip price elements that aren't worth annotating: strikethrough
 * "list" prices, "was" prices, and per-unit price breakdowns. These
 * misrepresent what the user is actually paying.
 */
function shouldSkipPriceElement(priceEl: Element): boolean {
  if (priceEl.classList.contains('a-text-price')) return true;
  if (priceEl.classList.contains('a-price--strike')) return true;
  if (priceEl.closest('.a-text-price') !== null) return true;
  return false;
}

function currentLocaleCurrency(): Currency | null {
  if (typeof window === 'undefined') return null;
  return hostnameToCurrency(window.location.hostname);
}

export const amazonDetector: Detector = {
  id: 'amazon',
  matches: isAmazonUrl,
  detect(root) {
    const results: DetectedPrice[] = [];
    const seenPrices = new Set<number>();
    const localeCurrency = currentLocaleCurrency();

    for (const priceEl of root.querySelectorAll('.a-price')) {
      if (shouldSkipPriceElement(priceEl)) continue;

      const text = readPriceText(priceEl);
      if (text === null) continue;
      const parsed = parsePriceString(text);
      if (parsed === null) continue;

      // If the text used a bare `$` (parser defaulted to USD) and we're on a
      // non-USD locale, the price is really the locale's currency.
      const currency =
        parsed.currency === 'USD' && localeCurrency !== null && localeCurrency !== 'USD'
          ? localeCurrency
          : parsed.currency;

      let priceUsd: number;
      try {
        priceUsd = toUsd(parsed.amount, currency);
      } catch {
        // FX table didn't know this currency; skip rather than mislabel.
        continue;
      }

      // Dedupe: the same price often appears repeatedly on a page (cart,
      // breadcrumb, mini-buy-box, sticky header). Render one pill per
      // unique value, anchored to the first occurrence — which is usually
      // the most prominent one in document order.
      const key = Math.round(priceUsd * 100);
      if (seenPrices.has(key)) continue;
      seenPrices.add(key);

      results.push({ priceUsd, anchorEl: priceEl });
    }
    return results;
  },
};
