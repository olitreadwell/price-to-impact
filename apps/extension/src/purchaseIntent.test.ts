/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wirePurchaseIntent } from './purchaseIntent';

let unwire: () => void;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  if (unwire) unwire();
});

function setBuyBoxPrice(text: string): void {
  document.body.innerHTML = `
    <div id="corePriceDisplay_desktop_feature_div">
      <span class="a-offscreen">${text}</span>
    </div>
    <button id="add-to-cart-button">Add to Cart</button>
  `;
}

describe('wirePurchaseIntent', () => {
  it('does nothing when isEnabled returns false', () => {
    setBuyBoxPrice('$24.99');
    const bumpJarBy = vi.fn();
    unwire = wirePurchaseIntent({ isEnabled: () => false, bumpJarBy });

    document.getElementById('add-to-cart-button')?.click();
    expect(document.getElementById('p2i-purchase-intent-toast')).toBeNull();
    expect(bumpJarBy).not.toHaveBeenCalled();
  });

  it('shows a toast on Add to Cart when enabled', () => {
    setBuyBoxPrice('$24.99');
    unwire = wirePurchaseIntent({ isEnabled: () => true, bumpJarBy: vi.fn() });

    document.getElementById('add-to-cart-button')?.click();

    const toast = document.getElementById('p2i-purchase-intent-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('$24.99');
    expect(toast?.textContent).toContain('1¢'); // ceil(24.99) - 24.99 = 0.01
  });

  it('calls bumpJarBy(cents) when user clicks "Yes"', () => {
    setBuyBoxPrice('$24.99');
    const bumpJarBy = vi.fn();
    unwire = wirePurchaseIntent({ isEnabled: () => true, bumpJarBy });

    document.getElementById('add-to-cart-button')?.click();
    const yesButton = document
      .getElementById('p2i-purchase-intent-toast')
      ?.querySelectorAll('button')[1];
    yesButton?.click();

    expect(bumpJarBy).toHaveBeenCalledWith(1);
  });

  it('does not bump the jar when user clicks "Not now"', () => {
    setBuyBoxPrice('$24.99');
    const bumpJarBy = vi.fn();
    unwire = wirePurchaseIntent({ isEnabled: () => true, bumpJarBy });

    document.getElementById('add-to-cart-button')?.click();
    const noButton = document
      .getElementById('p2i-purchase-intent-toast')
      ?.querySelectorAll('button')[0];
    noButton?.click();

    expect(bumpJarBy).not.toHaveBeenCalled();
  });

  it('skips the toast when the price is already a round dollar', () => {
    setBuyBoxPrice('$25.00');
    unwire = wirePurchaseIntent({ isEnabled: () => true, bumpJarBy: vi.fn() });

    document.getElementById('add-to-cart-button')?.click();
    expect(document.getElementById('p2i-purchase-intent-toast')).toBeNull();
  });

  it('does not preventDefault — the buy button still fires its own listeners', () => {
    setBuyBoxPrice('$24.99');
    unwire = wirePurchaseIntent({ isEnabled: () => true, bumpJarBy: vi.fn() });

    let amazonHandlerFired = false;
    const btn = document.getElementById('add-to-cart-button');
    btn?.addEventListener('click', () => {
      amazonHandlerFired = true;
    });

    btn?.click();
    expect(amazonHandlerFired).toBe(true);
  });

  it('matches Buy Now buttons too', () => {
    document.body.innerHTML = `
      <div id="corePriceDisplay_desktop_feature_div">
        <span class="a-offscreen">$24.99</span>
      </div>
      <button id="buy-now-button">Buy Now</button>
    `;
    unwire = wirePurchaseIntent({ isEnabled: () => true, bumpJarBy: vi.fn() });

    document.getElementById('buy-now-button')?.click();
    expect(document.getElementById('p2i-purchase-intent-toast')).not.toBeNull();
  });
});
