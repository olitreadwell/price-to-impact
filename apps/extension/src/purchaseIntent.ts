/**
 * Non-blocking toast prompted after the user clicks Amazon's "Add to
 * Cart" or "Buy Now" buttons. Asks whether they want to add the
 * round-up cents (jarContribution of the buy-box price) to the
 * charity jar.
 *
 * Opt-in via `prefs.purchaseIntentEnabled`. Off by default — we don't
 * intercept buy flows unless the user explicitly turns this on in the
 * options page.
 *
 * Design choices:
 * - Toast is a sibling of the page body, position:fixed bottom-right.
 *   We never preventDefault the buy-button click — Amazon's
 *   add-to-cart still proceeds normally.
 * - Auto-dismiss after 8s.
 * - On "Yes", a callback bumps the jar; on "Not now" or auto-dismiss,
 *   nothing happens.
 */

import { jarContribution, parsePriceString, toUsd } from '@price-to-impact/charities';

const BUY_BUTTON_SELECTOR = [
  '#add-to-cart-button',
  '[id^="add-to-cart-button-"]',
  '#buy-now-button',
  'input[name="submit.add-to-cart"]',
  'input[name="submit.buy-now"]',
].join(',');

const BUYBOX_PRICE_SELECTORS = [
  '#corePriceDisplay_desktop_feature_div .a-offscreen',
  '#apex_desktop .a-offscreen',
  '#corePrice_feature_div .a-offscreen',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '.a-price .a-offscreen',
];

const TOAST_ID = 'p2i-purchase-intent-toast';
const TOAST_STYLE = [
  'position:fixed',
  'bottom:24px',
  'right:24px',
  'z-index:2147483647',
  'max-width:320px',
  'padding:12px 14px',
  'background:#1f2937',
  'color:#f9fafb',
  'border-radius:8px',
  'box-shadow:0 8px 24px rgba(0,0,0,0.3)',
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  'font-size:13px',
  'line-height:1.4',
  'opacity:0',
  'transform:translateY(8px)',
  'transition:opacity 200ms ease, transform 200ms ease',
].join(';');

const TOAST_BTN_STYLE = [
  'padding:6px 10px',
  'border-radius:4px',
  'font:inherit',
  'font-size:12px',
  'font-weight:600',
  'cursor:pointer',
  'border:none',
].join(';');

function readBuyBoxPriceUsd(): number | null {
  for (const selector of BUYBOX_PRICE_SELECTORS) {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement)) continue;
    const text = el.textContent?.trim() ?? '';
    const parsed = parsePriceString(text);
    if (parsed === null) continue;
    try {
      return toUsd(parsed.amount, parsed.currency);
    } catch {
      continue;
    }
  }
  return null;
}

function removeExistingToast(): void {
  const existing = document.getElementById(TOAST_ID);
  if (existing !== null) existing.remove();
}

interface ToastArgs {
  readonly priceUsd: number;
  readonly cents: number;
  readonly onYes: () => void;
}

function showToast({ priceUsd, cents, onYes }: ToastArgs): void {
  removeExistingToast();

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('style', TOAST_STYLE);
  toast.setAttribute('role', 'dialog');
  toast.setAttribute('aria-live', 'polite');

  const message = document.createElement('div');
  message.textContent = `Round up your $${priceUsd.toFixed(2)} purchase? +${cents}¢ to your charity jar.`;
  message.style.marginBottom = '10px';

  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '8px';
  buttons.style.justifyContent = 'flex-end';

  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.setAttribute('style', `${TOAST_BTN_STYLE};background:transparent;color:#9ca3af`);
  noBtn.textContent = 'Not now';
  noBtn.addEventListener('click', () => dismissToast(toast));

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.setAttribute('style', `${TOAST_BTN_STYLE};background:#fbbf24;color:#1f2937`);
  yesBtn.textContent = `Yes, +${cents}¢`;
  yesBtn.addEventListener('click', () => {
    onYes();
    dismissToast(toast);
  });

  buttons.append(noBtn, yesBtn);
  toast.append(message, buttons);
  document.body.append(toast);

  // Force layout flush so the slide-in transition fires.
  void toast.offsetHeight;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  // Auto-dismiss after 8 seconds if the user ignores it.
  setTimeout(() => dismissToast(toast), 8000);
}

function dismissToast(toast: HTMLElement): void {
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(8px)';
  setTimeout(() => toast.remove(), 220);
}

export interface PurchaseIntentDeps {
  /** Read at click time — caller controls whether the prompt should fire. */
  isEnabled(): boolean;
  /** Bump the jar by `cents`. Implementation persists via storage. */
  bumpJarBy(cents: number): void;
}

/**
 * Wire the buy-button click listener. Returns an unwire function so
 * tests can tear down between cases.
 */
export function wirePurchaseIntent(deps: PurchaseIntentDeps): () => void {
  const handler = (e: Event): void => {
    if (!deps.isEnabled()) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const buyButton = target.closest(BUY_BUTTON_SELECTOR);
    if (buyButton === null) return;

    const priceUsd = readBuyBoxPriceUsd();
    if (priceUsd === null) return;
    const cents = jarContribution(priceUsd);
    // No round-up to offer when the price is already a round dollar.
    if (cents === 0) return;

    showToast({
      priceUsd,
      cents,
      onYes: () => deps.bumpJarBy(cents),
    });
  };

  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}
