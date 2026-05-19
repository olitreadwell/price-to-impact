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

  it('does nothing when no mock-price elements are present', () => {
    document.body.innerHTML = `<span class="a-price">$24.99</span>`;

    run();

    expect(document.body.querySelectorAll('[data-p2i-pill]')).toHaveLength(0);
  });
});
