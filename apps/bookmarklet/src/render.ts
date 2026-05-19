/**
 * Inserts impact badges ("pills") next to detected prices and clears them.
 *
 * Each pill is an anchor that opens the charity's donate page in a new
 * tab. Style isolation is via the `style` attribute (highest specificity
 * short of `!important`) plus a unique class + data attribute. We
 * deliberately avoid Shadow DOM so the bookmarklet stays a single
 * inline IIFE.
 */

const PILL_CLASS = 'p2i-pill';
const PILL_DATA_ATTR = 'data-p2i-pill';

const PILL_STYLE = [
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

function ownerDoc(el: Element): Document {
  return el.ownerDocument ?? document;
}

/**
 * Inline `style=` has higher specificity than any class selector but
 * can't express pseudo-classes like `:hover`. Inject a one-time style
 * element with `!important` hover overrides so a mouseover lifts the
 * pill slightly and darkens its background. Keyed by id so we never
 * inject twice into the same document.
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

/** Options for {@link renderPill}. */
export interface PillOptions {
  /** Visible label, e.g. `🦟 ≈ 1.8 nets`. */
  readonly label: string;
  /** Charity donation URL. Opened in a new tab on click. */
  readonly href: string;
  /** Accessible title shown on hover and to screen readers. */
  readonly title?: string;
}

/**
 * Insert a pill after `target`. If an existing pill is already present
 * (a sibling with the marker attribute), it is updated in place —
 * calling `renderPill` twice on the same anchor never produces a
 * duplicate badge.
 */
export function renderPill(target: Element, options: PillOptions): void {
  const { label, href, title } = options;
  if (!isSafeHttpUrl(href)) return;

  const doc = ownerDoc(target);
  ensureHoverStyles(doc);

  const existing = target.nextElementSibling;
  if (existing instanceof HTMLAnchorElement && existing.hasAttribute(PILL_DATA_ATTR)) {
    existing.textContent = label;
    existing.href = href;
    if (title !== undefined) existing.title = title;
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
  pill.textContent = label;
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
