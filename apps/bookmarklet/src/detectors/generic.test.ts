import { beforeEach, describe, expect, it } from 'vitest';
import { genericDetector } from './generic';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('genericDetector.matches', () => {
  it('never matches automatically — opt-in only', () => {
    expect(genericDetector.matches(new URL('https://example.com/'))).toBe(false);
    expect(genericDetector.matches(new URL('https://shop.example/products/x'))).toBe(false);
  });
});

describe('genericDetector.detect', () => {
  it('finds a price in plain text and anchors at the parent element', () => {
    document.body.innerHTML = `<p id="anchor">Now only $24.99</p>`;
    const results = genericDetector.detect(document.body);
    expect(results).toHaveLength(1);
    expect(results[0]?.priceUsd).toBeCloseTo(24.99);
    expect(results[0]?.anchorEl.id).toBe('anchor');
  });

  it('matches single-digit prefixed prices (regression: $5)', () => {
    document.body.innerHTML = `<p>Special offer: $5 today only</p>`;
    const results = genericDetector.detect(document.body);
    expect(results).toHaveLength(1);
    expect(results[0]?.priceUsd).toBeCloseTo(5);
  });

  it('dedupes the same price appearing twice in a paragraph', () => {
    document.body.innerHTML = `<p>$24.99 — also $24.99 for premium members</p>`;
    expect(genericDetector.detect(document.body)).toHaveLength(1);
  });

  it('emits one pill per unique value', () => {
    document.body.innerHTML = `
      <div>$10.00</div>
      <div>$20.00</div>
      <div>$30.00</div>
    `;
    const values = genericDetector
      .detect(document.body)
      .map((r) => r.priceUsd)
      .sort((a, b) => a - b);
    expect(values).toEqual([10, 20, 30]);
  });

  it('skips matches inside <script>', () => {
    document.body.innerHTML = `<script>const price = "$24.99";</script><p>Not really</p>`;
    expect(genericDetector.detect(document.body)).toHaveLength(0);
  });

  it('skips matches inside <style>', () => {
    document.body.innerHTML = `<style>/* $1.99 in a comment */</style>`;
    expect(genericDetector.detect(document.body)).toHaveLength(0);
  });

  it('rejects sub-MIN_USD values (likely noise)', () => {
    document.body.innerHTML = `<p>List price: $0.10 per unit</p>`;
    expect(genericDetector.detect(document.body)).toHaveLength(0);
  });

  it('converts non-USD prices via the FX table (£99 → ~$123)', () => {
    document.body.innerHTML = `<p>Today only: £99.00 + shipping</p>`;
    const [result] = genericDetector.detect(document.body);
    // GBP rate is 1.25 USD/GBP, so 99 → 123.75 USD.
    expect(result?.priceUsd).toBeCloseTo(123.75, 1);
  });

  it('skips text in elements with style="display:none"', () => {
    document.body.innerHTML = `<p style="display:none">$24.99</p>`;
    expect(genericDetector.detect(document.body)).toHaveLength(0);
  });
});
