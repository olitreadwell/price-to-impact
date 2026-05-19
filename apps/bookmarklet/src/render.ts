/**
 * Inserts impact badges ("pills") next to detected prices and clears them.
 *
 * Each pill is an anchor that opens the charity's donate page in a new
 * tab. Style isolation is via the `style` attribute (highest specificity
 * short of `!important`) plus a unique class + data attribute. We
 * deliberately avoid Shadow DOM so the bookmarklet stays a single
 * inline IIFE.
 *
 * Optional info-card: when {@link PillOptions.card} is set, the pill
 * renders a hidden card child that reveals on `:hover` and
 * `:focus-visible`. The card contains the charity name, the math,
 * the cost basis, the source, and an optional jar line — enough for
 * the user to decide whether to commit before clicking through.
 */

const PILL_CLASS = 'p2i-pill';
const PILL_LABEL_CLASS = 'p2i-pill-label';
const PILL_CARD_CLASS = 'p2i-pill-card';
const PILL_DATA_ATTR = 'data-p2i-pill';

const PILL_STYLE = [
  'position:relative',
  'display:inline-block',
  'margin-left:6px',
  'padding:2px 6px',
  'border-radius:4px',
  'background:#fbbf24',
  'color:#1f2937',
  'font-size:12px',
  'font-weight:600',
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  'line-height:1.4',
  'vertical-align:middle',
  'box-shadow:0 1px 2px rgba(0,0,0,0.15)',
  'white-space:nowrap',
  'text-decoration:none',
  'cursor:pointer',
].join(';');

const CARD_STYLE = [
  'display:none',
  'position:absolute',
  'top:calc(100% + 6px)',
  'left:0',
  'z-index:2147483647', // top of stacking context
  'width:max-content',
  'max-width:280px',
  'min-width:200px',
  'padding:10px 12px',
  'background:#1f2937',
  'color:#f9fafb',
  'border-radius:6px',
  'box-shadow:0 6px 18px rgba(0,0,0,0.25)',
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  'font-size:12px',
  'font-weight:400',
  'line-height:1.5',
  'white-space:normal',
  'text-align:left',
].join(';');

const CARD_TITLE_STYLE = [
  'font-weight:600',
  'font-size:13px',
  'margin-bottom:4px',
].join(';');

const CARD_SUBTITLE_STYLE = [
  'font-size:13px',
  'margin-bottom:8px',
  'color:#fde68a', // soft amber
].join(';');

const CARD_META_STYLE = ['font-size:11px', 'color:#d1d5db', 'margin-top:2px'].join(';');

const CARD_CTA_STYLE = [
  'margin-top:8px',
  'padding-top:8px',
  'border-top:1px solid #374151',
  'font-size:12px',
  'font-weight:600',
  'color:#fbbf24',
].join(';');

function ownerDoc(el: Element): Document {
  return el.ownerDocument ?? document;
}

/**
 * Inline `style=` has higher specificity than any class selector but
 * can't express pseudo-classes. We inject a one-time style element
 * with `!important` overrides for hover + focus, and to flip the card
 * from `display:none` to `display:block` on the same triggers.
 */
const HOVER_STYLE_ID = 'p2i-pill-hover-style';
const HOVER_STYLE_CSS = `
.${PILL_CLASS} {
  transition: background-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}
.${PILL_CLASS}:hover {
  background-color: #f59e0b !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
  transform: translateY(-1px) !important;
}
.${PILL_CLASS}:focus-visible {
  outline: 2px solid #1f2937 !important;
  outline-offset: 2px !important;
}
.${PILL_CLASS}:hover .${PILL_CARD_CLASS},
.${PILL_CLASS}:focus-visible .${PILL_CARD_CLASS},
.${PILL_CLASS}:focus-within .${PILL_CARD_CLASS} {
  display: block !important;
}
`;

function ensureHoverStyles(doc: Document): void {
  if (doc.getElementById(HOVER_STYLE_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = HOVER_STYLE_ID;
  style.textContent = HOVER_STYLE_CSS;
  (doc.head ?? doc.documentElement).append(style);
}

/**
 * Defense in depth: reject any href that isn't `http://` or `https://`.
 * Today every charity donateUrl is a trusted hardcoded https string, but
 * if that data ever flows from outside the codebase a `javascript:` URL
 * here would become an XSS sink. Cheaper to validate at the boundary.
 */
function isSafeHttpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Structured info-card content. Rendered as `textContent` only, never
 * `innerHTML`, so even untrusted strings can't inject markup.
 */
export interface PillCard {
  /** Card heading, typically the charity name. */
  readonly title: string;
  /** Featured line, typically the "$X ≈ N units" math. */
  readonly subtitle: string;
  /** Small grey lines below: cost basis, source + asOf, jar status. */
  readonly meta: readonly string[];
  /** Optional call-to-action line at the bottom, e.g. "Click to donate $24.99 →". */
  readonly cta?: string;
}

/** Options for {@link renderPill}. */
export interface PillOptions {
  /** Visible label, e.g. `🦟 ≈ 1.8 nets`. */
  readonly label: string;
  /** Charity donation URL. Opened in a new tab on click. */
  readonly href: string;
  /** Accessible title shown on hover and to screen readers. */
  readonly title?: string;
  /** Optional info-card shown on hover/focus. */
  readonly card?: PillCard;
}

function buildCard(doc: Document, card: PillCard): HTMLDivElement {
  const root = doc.createElement('div');
  root.className = PILL_CARD_CLASS;
  root.setAttribute('style', CARD_STYLE);
  root.setAttribute('role', 'tooltip');

  const title = doc.createElement('div');
  title.setAttribute('style', CARD_TITLE_STYLE);
  title.textContent = card.title;
  root.append(title);

  const subtitle = doc.createElement('div');
  subtitle.setAttribute('style', CARD_SUBTITLE_STYLE);
  subtitle.textContent = card.subtitle;
  root.append(subtitle);

  for (const line of card.meta) {
    const m = doc.createElement('div');
    m.setAttribute('style', CARD_META_STYLE);
    m.textContent = line;
    root.append(m);
  }

  if (card.cta !== undefined) {
    const cta = doc.createElement('div');
    cta.setAttribute('style', CARD_CTA_STYLE);
    cta.textContent = card.cta;
    root.append(cta);
  }

  return root;
}

function setPillContent(pill: HTMLAnchorElement, options: PillOptions): void {
  const doc = ownerDoc(pill);
  const label = doc.createElement('span');
  label.className = PILL_LABEL_CLASS;
  label.textContent = options.label;

  if (options.card === undefined) {
    pill.replaceChildren(label);
  } else {
    pill.replaceChildren(label, buildCard(doc, options.card));
  }
}

/**
 * Insert a pill after `target`. If an existing pill is already present
 * (a sibling with the marker attribute), it is updated in place —
 * calling `renderPill` twice on the same anchor never produces a
 * duplicate badge.
 */
export function renderPill(target: Element, options: PillOptions): void {
  const { href, title } = options;
  if (!isSafeHttpUrl(href)) return;

  const doc = ownerDoc(target);
  ensureHoverStyles(doc);

  const existing = target.nextElementSibling;
  if (existing instanceof HTMLAnchorElement && existing.hasAttribute(PILL_DATA_ATTR)) {
    existing.href = href;
    if (title !== undefined) existing.title = title;
    setPillContent(existing, options);
    return;
  }
  const pill = doc.createElement('a');
  pill.className = PILL_CLASS;
  pill.setAttribute(PILL_DATA_ATTR, '');
  pill.setAttribute('style', PILL_STYLE);
  pill.href = href;
  pill.target = '_blank';
  pill.rel = 'noopener noreferrer';
  if (title !== undefined) pill.title = title;
  setPillContent(pill, options);
  // Prevent the click from also activating an enclosing anchor (e.g.
  // Amazon's product card wraps the whole tile in a link).
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  target.insertAdjacentElement('afterend', pill);
}

/** Remove every pill rendered into `root` by this bookmarklet. */
export function clearPills(root: ParentNode): void {
  for (const pill of root.querySelectorAll(`[${PILL_DATA_ATTR}]`)) {
    pill.remove();
  }
}
