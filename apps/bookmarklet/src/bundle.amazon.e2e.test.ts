/**
 * @vitest-environment happy-dom
 * @vitest-environment-options { "url": "http://www.amazon.com/dp/B08N5WRWNW" }
 */

/**
 * End-to-end test for the bundled bookmarklet IIFE — running against
 * Amazon-shaped DOM with happy-dom configured to report
 * `www.amazon.com` as the host so the Amazon detector takes over.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const GENERATED_PATH = resolve(
  import.meta.dirname,
  '../../web/src/generated/bookmarklet.ts',
);

function loadBundleSource(): string {
  const ts = readFileSync(GENERATED_PATH, 'utf-8');
  const match = ts.match(/bookmarkletSource: string = (".*");\s*$/m);
  if (match === null) {
    throw new Error(`Could not parse bookmarklet source from ${GENERATED_PATH}`);
  }
  return JSON.parse(match[1]!);
}

function executeBookmarklet(source: string): void {
  new Function(source)();
}

let bundleSource: string;

beforeAll(() => {
  bundleSource = loadBundleSource();
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('bundled bookmarklet IIFE (amazon.com host)', () => {
  it('confirms happy-dom is reporting an amazon.com host', () => {
    expect(window.location.hostname).toBe('www.amazon.com');
  });

  it('annotates a single Amazon .a-price block', () => {
    document.body.innerHTML = `
      <span class="a-price">
        <span class="a-offscreen">$24.99</span>
        <span aria-hidden="true">$24<sup>99</sup></span>
      </span>
    `;
    executeBookmarklet(bundleSource);

    const pills = document.querySelectorAll('[data-p2i-pill]');
    expect(pills).toHaveLength(1);
    // $24.99 / $5.50 ≈ 4.5 nets — verifies bundled charity data integrity.
    expect(pills[0]?.textContent).toMatch(/\b4\.5 nets\b/);
  });

  it('annotates a price-range pair as two separate pills', () => {
    document.body.innerHTML = `
      <span class="a-price-range">
        <span class="a-price"><span class="a-offscreen">$10.00</span></span>
        <span class="a-price"><span class="a-offscreen">$20.00</span></span>
      </span>
    `;
    executeBookmarklet(bundleSource);
    expect(document.querySelectorAll('[data-p2i-pill]')).toHaveLength(2);
  });

  it('dedupes repeated identical prices into one pill', () => {
    document.body.innerHTML = `
      <span class="a-price"><span class="a-offscreen">$17.84</span></span>
      <span class="a-price"><span class="a-offscreen">$17.84</span></span>
      <span class="a-price"><span class="a-offscreen">$17.84</span></span>
    `;
    executeBookmarklet(bundleSource);
    expect(document.querySelectorAll('[data-p2i-pill]')).toHaveLength(1);
  });

  it('skips strikethrough list prices', () => {
    document.body.innerHTML = `
      <span class="a-price a-text-price"><span class="a-offscreen">$39.99</span></span>
      <span class="a-price"><span class="a-offscreen">$24.99</span></span>
    `;
    executeBookmarklet(bundleSource);
    const pills = document.querySelectorAll('[data-p2i-pill]');
    expect(pills).toHaveLength(1);
    // 24.99 / 5.50 ≈ 4.5 — confirms the live (not strikethrough) price was used.
    expect(pills[0]?.textContent).toMatch(/\b4\.5 nets\b/);
  });

  it('renders pills as anchors deep-linked to every.org with amount pre-filled', () => {
    document.body.innerHTML = `
      <span class="a-price"><span class="a-offscreen">$24.99</span></span>
    `;
    executeBookmarklet(bundleSource);

    const pill = document.querySelector('[data-p2i-pill]') as HTMLAnchorElement | null;
    expect(pill).not.toBeNull();
    expect(pill?.tagName).toBe('A');
    expect(pill?.href).toContain('every.org/against-malaria-foundation/donate');
    expect(pill?.href).toContain('amount=24.99');
    expect(pill?.target).toBe('_blank');
  });

  it('handles "$1,299.00" with thousands separators (≈ 236 nets)', () => {
    document.body.innerHTML = `
      <span class="a-price"><span class="a-offscreen">$1,299.00</span></span>
    `;
    executeBookmarklet(bundleSource);
    const pill = document.querySelector('[data-p2i-pill]');
    expect(pill?.textContent).toMatch(/\b236 nets\b/);
  });

  it('skips unparseable prices (e.g. "unavailable")', () => {
    document.body.innerHTML = `
      <span class="a-price"><span class="a-offscreen">unavailable</span></span>
    `;
    executeBookmarklet(bundleSource);
    expect(document.querySelectorAll('[data-p2i-pill]')).toHaveLength(0);
  });
});
