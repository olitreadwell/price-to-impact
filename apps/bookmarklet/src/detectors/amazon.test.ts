import { beforeEach, describe, expect, it } from 'vitest';
import { amazonDetector } from './amazon';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('amazonDetector.matches', () => {
  it.each([
    'https://www.amazon.com/dp/B08N5WRWNW',
    'https://amazon.com/',
    'https://smile.amazon.com/something',
    'https://www.amazon.co.uk/',
    'https://www.amazon.de/',
    'https://www.amazon.com.au/',
    'https://www.amazon.ca/',
    'https://www.amazon.fr/',
  ])('matches %s', (href) => {
    expect(amazonDetector.matches(new URL(href))).toBe(true);
  });

  it.each([
    'https://amazon.evil.com/',
    'https://example.com/amazon.com',
    'https://www.amazon.xx/',
    'https://amazon-bait.com/',
  ])('does not match %s', (href) => {
    expect(amazonDetector.matches(new URL(href))).toBe(false);
  });
});

describe('amazonDetector.detect', () => {
  it('extracts a price from the canonical .a-offscreen pattern', () => {
    document.body.innerHTML = `
      <span class="a-price">
        <span class="a-offscreen">$24.99</span>
        <span aria-hidden="true">
          <span class="a-price-symbol">$</span>
          <span class="a-price-whole">24<span class="a-price-decimal">.</span></span>
          <span class="a-price-fraction">99</span>
        </span>
      </span>
    `;

    const results = amazonDetector.detect(document.body);

    expect(results).toHaveLength(1);
    expect(results[0]?.priceUsd).toBeCloseTo(24.99);
  });

  it('falls back to whole + fraction when .a-offscreen is missing', () => {
    document.body.innerHTML = `
      <span class="a-price">
        <span class="a-price-symbol">$</span>
        <span class="a-price-whole">42</span>
        <span class="a-price-fraction">50</span>
      </span>
    `;

    const results = amazonDetector.detect(document.body);

    expect(results).toHaveLength(1);
    expect(results[0]?.priceUsd).toBeCloseTo(42.5);
  });

  it('emits one detection per .a-price in a price range', () => {
    document.body.innerHTML = `
      <span class="a-price-range">
        <span class="a-price"><span class="a-offscreen">$10.00</span></span>
        <span class="a-price"><span class="a-offscreen">$20.00</span></span>
      </span>
    `;

    const results = amazonDetector.detect(document.body);

    expect(results.map((r) => r.priceUsd)).toEqual([10, 20]);
  });

  it('handles thousand-separators (e.g. "$1,299.00")', () => {
    document.body.innerHTML = `
      <span class="a-price"><span class="a-offscreen">$1,299.00</span></span>
    `;

    const results = amazonDetector.detect(document.body);

    expect(results[0]?.priceUsd).toBeCloseTo(1299);
  });

  it('returns nothing when the page has no .a-price elements', () => {
    document.body.innerHTML = '<div>No prices here</div>';

    expect(amazonDetector.detect(document.body)).toHaveLength(0);
  });

  it('skips a .a-price whose .a-offscreen contains no parseable price', () => {
    document.body.innerHTML = `
      <span class="a-price"><span class="a-offscreen">unavailable</span></span>
    `;

    expect(amazonDetector.detect(document.body)).toHaveLength(0);
  });

  it('skips strikethrough list prices (.a-text-price)', () => {
    document.body.innerHTML = `
      <span class="a-price a-text-price">
        <span class="a-offscreen">$39.99</span>
      </span>
      <span class="a-price">
        <span class="a-offscreen">$24.99</span>
      </span>
    `;

    const results = amazonDetector.detect(document.body);
    expect(results).toHaveLength(1);
    expect(results[0]?.priceUsd).toBeCloseTo(24.99);
  });

  it('skips a .a-price nested inside a strikethrough container', () => {
    document.body.innerHTML = `
      <span class="a-text-price">
        <span class="a-price">
          <span class="a-offscreen">$99.00</span>
        </span>
      </span>
    `;

    expect(amazonDetector.detect(document.body)).toHaveLength(0);
  });

  it('dedupes by price value — same $X.XX shown N times → one pill', () => {
    document.body.innerHTML = `
      <span class="a-price"><span class="a-offscreen">$17.84</span></span>
      <span class="a-price"><span class="a-offscreen">$17.84</span></span>
      <span class="a-price"><span class="a-offscreen">$17.84</span></span>
      <span class="a-price"><span class="a-offscreen">$24.99</span></span>
    `;

    const results = amazonDetector.detect(document.body);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.priceUsd).sort()).toEqual([17.84, 24.99]);
  });

  it('dedup anchor is the first occurrence in document order', () => {
    document.body.innerHTML = `
      <span class="a-price" id="first"><span class="a-offscreen">$17.84</span></span>
      <span class="a-price" id="second"><span class="a-offscreen">$17.84</span></span>
    `;

    const results = amazonDetector.detect(document.body);
    expect(results).toHaveLength(1);
    expect(results[0]?.anchorEl.id).toBe('first');
  });

  it('anchors each result at the .a-price element for pill placement', () => {
    document.body.innerHTML = `
      <span class="a-price" id="target">
        <span class="a-offscreen">$5.00</span>
      </span>
    `;

    const [result] = amazonDetector.detect(document.body);

    expect(result?.anchorEl.id).toBe('target');
    expect(result?.anchorEl.classList.contains('a-price')).toBe(true);
  });
});
