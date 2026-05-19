import { parsePriceString } from '@price-to-impact/charities';
import type { DetectedPrice, Detector } from '../types';

/**
 * Generic last-resort detector.
 *
 * Walks text nodes, picks out anything that looks like a price token
 * (`$X.XX`, `£X.XX`, `€X,XX`, etc.) and emits one DetectedPrice per
 * unique parent element. Designed to be:
 *
 * - **Safe to opt in everywhere**: filters out matches that look like
 *   product specs (e.g. `2.5"`, `4K`, `$0.05` unit-pricing fragments)
 *   by enforcing a minimum value and rejecting matches embedded inside
 *   `script`, `style`, `noscript`, or hidden subtrees.
 * - **Conservative on false positives**: dedupes by exact value AND by
 *   anchor element so a paragraph mentioning "$24.99" twice gets a
 *   single pill.
 *
 * Real-world coverage is best-effort. Per-site detectors should be
 * preferred where they exist — this is the safety net.
 */

// First alt: explicit currency *prefix*, then a number with optional
// trailing-digit so single-digit prices like "$5" match. Second alt:
// number followed by a currency *suffix* token.
const PRICE_RE = /(?:[\$£€]|US\$|NZ\$|CA\$|AU\$|USD|GBP|EUR|NZD|CAD|AUD)\s?-?\d[\d., ]*\d?|\d+(?:[.,]\d{1,2})?\s?(?:USD|GBP|EUR|NZD|CAD|AUD)/i;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'CODE', 'PRE']);

const MIN_USD = 0.5; // below this is almost certainly noise / unit price
const MAX_USD = 100_000; // hard cap to keep the FX result sane

/** Minimum length of a text node we'll bother regex-scanning. */
const MIN_TEXT_LEN = 2;
/**
 * Maximum length of a text node we'll regex-scan. Long text nodes are
 * usually article copy where a stray "$24.99" is meta, not a real
 * price, and a long node would dominate the per-tick cost.
 */
const MAX_TEXT_LEN = 200;

/**
 * Cheap visibility check — only rules out the obvious hidden cases (the
 * `hidden` attribute and inline `display:none`). We deliberately do not
 * call getComputedStyle here: every text-node ancestor would trigger a
 * layout flush. Anything more accurate belongs in a higher-fidelity
 * detector if we ever need one.
 */
function notObviouslyHidden(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  if (el.hidden) return false;
  return el.style.display !== 'none';
}

function nearestBlockAnchor(node: Node): Element | null {
  let current: Node | null = node.parentNode;
  while (current !== null) {
    if (current instanceof Element) return current;
    current = current.parentNode;
  }
  return null;
}

function* visibleTextNodes(node: Node): Generator<Text> {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    yield node as Text;
    return;
  }
  if (node instanceof Element) {
    if (SKIP_TAGS.has(node.tagName)) return;
    if (!notObviouslyHidden(node)) return;
  }
  for (const child of Array.from(node.childNodes)) yield* visibleTextNodes(child);
}

export const genericDetector: Detector = {
  id: 'generic',
  // Opt-in: never matches automatically. Bookmarklet activation falls
  // back to this via direct call; the extension wires it through prefs
  // (a future per-site allowlist).
  matches: () => false,
  detect(root) {
    const results: DetectedPrice[] = [];
    const seenValues = new Set<number>();
    const seenAnchors = new WeakSet<Element>();

    for (const node of visibleTextNodes(root)) {
      const text = node.nodeValue ?? '';
      if (text.length < MIN_TEXT_LEN || text.length > MAX_TEXT_LEN) continue;
      const match = text.match(PRICE_RE);
      if (match === null) continue;

      const parsed = parsePriceString(match[0]);
      if (parsed === null) continue;
      if (parsed.amount < MIN_USD || parsed.amount > MAX_USD) continue;

      // The generic detector only ships USD-ish prices for now — same
      // limitation as the v1 Amazon detector, kept narrow to avoid
      // mis-labelling without FX from a known hostname.
      if (parsed.currency !== 'USD') continue;

      const anchor = nearestBlockAnchor(node);
      if (anchor === null) continue;
      if (seenAnchors.has(anchor)) continue;

      const key = Math.round(parsed.amount * 100);
      if (seenValues.has(key)) continue;
      seenValues.add(key);
      seenAnchors.add(anchor);

      results.push({ priceUsd: parsed.amount, anchorEl: anchor });
    }

    return results;
  },
};
