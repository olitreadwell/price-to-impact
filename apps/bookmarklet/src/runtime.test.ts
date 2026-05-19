import { beforeEach, describe, expect, it } from 'vitest';
import { run } from './runtime';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('run (with mock detector)', () => {
  it('renders a pill next to every mocked price', () => {
    document.body.innerHTML = `
      <span data-p2i-mock-price="11">$11</span>
      <span data-p2i-mock-price="55">$55</span>
    `;

    run();

    expect(document.body.querySelectorAll('[data-p2i-pill]')).toHaveLength(2);
  });

  it('is idempotent — second run replaces pills instead of duplicating', () => {
    document.body.innerHTML = `<span data-p2i-mock-price="11">$11</span>`;

    run();
    run();

    expect(document.body.querySelectorAll('[data-p2i-pill]')).toHaveLength(1);
  });

  it('uses the first charity (AMF) for v1 labels', () => {
    document.body.innerHTML = `<span data-p2i-mock-price="11">$11</span>`;

    run();

    const pillText = document.body.querySelector('[data-p2i-pill]')?.textContent ?? '';
    expect(pillText).toContain('🦟');
    expect(pillText).toContain('nets');
  });

  it('does nothing on a page with no price-shaped text', () => {
    document.body.innerHTML = `<p>Lorem ipsum dolor sit amet.</p>`;

    run();

    expect(document.body.querySelectorAll('[data-p2i-pill]')).toHaveLength(0);
  });

  it('falls through to generic detector on non-Amazon hosts when text has prices', () => {
    document.body.innerHTML = `<p>Final clearance: $24.99 today only</p>`;

    run();

    expect(document.body.querySelectorAll('[data-p2i-pill]')).toHaveLength(1);
  });
});
