/**
 * End-to-end test for the bundled bookmarklet IIFE — non-Amazon hosts.
 *
 * Loads the generated artifact from apps/web/src/generated/bookmarklet.ts,
 * evaluates it via `new Function` in a happy-dom environment, and asserts
 * the rendered DOM. This validates the *shipped* JavaScript, not just the
 * TypeScript source — bundler regressions, tree-shaking surprises, and
 * IIFE-wrapping bugs all surface here.
 *
 * On a non-Amazon host (happy-dom's default localhost), only the mock
 * detector fires. The Amazon flow lives in bundle.amazon.e2e.test.ts.
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
  // `new Function` is the standard way to evaluate a bookmarklet payload
  // in a test environment. The IIFE captures window/document from the
  // global scope, which happy-dom provides.
  new Function(source)();
}

let bundleSource: string;

beforeAll(() => {
  bundleSource = loadBundleSource();
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('bundled bookmarklet IIFE (non-Amazon host)', () => {
  it('parses and executes without throwing', () => {
    expect(() => executeBookmarklet(bundleSource)).not.toThrow();
  });

  it('does nothing on a page with no detectable prices', () => {
    document.body.innerHTML = '<p>Nothing to see here.</p>';
    executeBookmarklet(bundleSource);
    expect(document.querySelectorAll('[data-p2i-pill]')).toHaveLength(0);
  });

  it('renders a pill per data-p2i-mock-price element', () => {
    document.body.innerHTML = `
      <span data-p2i-mock-price="9.99">$9.99</span>
      <span data-p2i-mock-price="249">$249.00</span>
      <span data-p2i-mock-price="1299">$1,299.00</span>
    `;
    executeBookmarklet(bundleSource);
    expect(document.querySelectorAll('[data-p2i-pill]')).toHaveLength(3);
  });

  it('produces the expected AMF math for $249 ($5.50/net → ~45 nets)', () => {
    document.body.innerHTML = `<span data-p2i-mock-price="249">$249</span>`;
    executeBookmarklet(bundleSource);
    const pill = document.querySelector('[data-p2i-pill]');
    expect(pill?.textContent).toMatch(/\b45 nets\b/);
    expect(pill?.textContent).toContain('🦟');
  });

  it('is idempotent — running twice replaces pills, never duplicates', () => {
    document.body.innerHTML = `
      <span data-p2i-mock-price="9.99">$9.99</span>
      <span data-p2i-mock-price="249">$249</span>
    `;
    executeBookmarklet(bundleSource);
    executeBookmarklet(bundleSource);
    expect(document.querySelectorAll('[data-p2i-pill]')).toHaveLength(2);
  });

  it('applies inline styles so page CSS cannot override the pill', () => {
    document.body.innerHTML = `<span data-p2i-mock-price="11">$11</span>`;
    executeBookmarklet(bundleSource);

    const style = document.querySelector('[data-p2i-pill]')?.getAttribute('style') ?? '';
    expect(style).toContain('display:inline-block');
    expect(style).toContain('background:#fbbf24');
  });

  it('falls through to generic detector on non-Amazon hosts', () => {
    // The Amazon-shaped class is irrelevant off-Amazon; what matters is
    // that the text "$24.99" is visible price-shaped text the generic
    // detector picks up.
    document.body.innerHTML = `<p>Sale: $24.99</p>`;
    executeBookmarklet(bundleSource);
    expect(document.querySelectorAll('[data-p2i-pill]')).toHaveLength(1);
  });
});
