/**
 * Inserts impact badges ("pills") next to detected prices and clears them.
 *
 * Style isolation is via the `style` attribute (highest specificity short of
 * `!important`) plus a unique class + data attribute. We deliberately avoid
 * Shadow DOM so the bookmarklet stays a single inline IIFE.
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
].join(';');

function ownerDoc(el: Element): Document {
  return el.ownerDocument ?? document;
}

/**
 * Insert a pill after `target`. If an existing pill is already present (a
 * sibling with the marker attribute), it is updated in place — calling
 * `renderPill` twice on the same anchor never produces a duplicate badge.
 */
export function renderPill(target: Element, label: string): void {
  const existing = target.nextElementSibling;
  if (existing instanceof Element && existing.hasAttribute(PILL_DATA_ATTR)) {
    existing.textContent = label;
    return;
  }
  const pill = ownerDoc(target).createElement('span');
  pill.className = PILL_CLASS;
  pill.setAttribute(PILL_DATA_ATTR, '');
  pill.setAttribute('style', PILL_STYLE);
  pill.textContent = label;
  target.insertAdjacentElement('afterend', pill);
}

/** Remove every pill rendered into `root` by this bookmarklet. */
export function clearPills(root: ParentNode): void {
  for (const pill of root.querySelectorAll(`[${PILL_DATA_ATTR}]`)) {
    pill.remove();
  }
}
