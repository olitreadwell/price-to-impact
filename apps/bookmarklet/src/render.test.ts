import { beforeEach, describe, expect, it } from 'vitest';
import { clearPills, renderPill } from './render';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('renderPill', () => {
  it('inserts a pill immediately after the target', () => {
    const target = document.createElement('span');
    target.textContent = '$24.99';
    document.body.append(target);

    renderPill(target, '≈ 4 nets 🦟');

    const pill = target.nextElementSibling;
    expect(pill).not.toBeNull();
    expect(pill?.tagName).toBe('SPAN');
    expect(pill?.textContent).toBe('≈ 4 nets 🦟');
  });

  it('updates the existing pill instead of duplicating', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, 'first');
    renderPill(target, 'second');

    const pills = document.body.querySelectorAll('[data-p2i-pill]');
    expect(pills).toHaveLength(1);
    expect(pills[0]?.textContent).toBe('second');
  });

  it('applies inline styles for isolation from page CSS', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, 'x');

    const style = target.nextElementSibling?.getAttribute('style') ?? '';
    expect(style).toContain('display:inline-block');
    expect(style).toContain('background:#fbbf24');
  });

  it('does not mistake an unrelated sibling for a pill', () => {
    const target = document.createElement('span');
    const sibling = document.createElement('span');
    sibling.textContent = 'unrelated';
    document.body.append(target, sibling);

    renderPill(target, 'pill');

    expect(target.nextElementSibling?.textContent).toBe('pill');
    expect(target.nextElementSibling?.nextElementSibling?.textContent).toBe('unrelated');
  });
});

describe('clearPills', () => {
  it('removes every pill from the tree', () => {
    document.body.innerHTML = `
      <span>$1</span><span class="p2i-pill" data-p2i-pill>a</span>
      <span>$2</span><span class="p2i-pill" data-p2i-pill>b</span>
    `;

    clearPills(document.body);

    expect(document.body.querySelectorAll('[data-p2i-pill]')).toHaveLength(0);
  });

  it('leaves non-pill elements alone', () => {
    document.body.innerHTML = `
      <span class="a-price">$5</span>
      <span class="p2i-pill" data-p2i-pill>x</span>
    `;

    clearPills(document.body);

    expect(document.body.querySelector('.a-price')).not.toBeNull();
  });
});
