import { beforeEach, describe, expect, it } from 'vitest';
import { clearPills, renderPill } from './render';

const HREF = 'https://www.againstmalaria.com/Donation.aspx';
const opts = (label: string, href: string = HREF) => ({ label, href });

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('renderPill', () => {
  it('inserts a pill immediately after the target', () => {
    const target = document.createElement('span');
    target.textContent = '$24.99';
    document.body.append(target);

    renderPill(target, opts('≈ 4 nets 🦟'));

    const pill = target.nextElementSibling;
    expect(pill).not.toBeNull();
    expect(pill?.tagName).toBe('A');
    expect(pill?.textContent).toBe('≈ 4 nets 🦟');
  });

  it('renders an anchor that opens the donate URL in a new tab', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, opts('🦟 ≈ 4 nets'));

    const pill = target.nextElementSibling as HTMLAnchorElement;
    expect(pill.href).toBe(HREF);
    expect(pill.target).toBe('_blank');
    expect(pill.rel).toBe('noopener noreferrer');
  });

  it('uses the provided title for hover/screen-reader text', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, { label: 'x', href: HREF, title: 'Donate to AMF' });

    expect(target.nextElementSibling?.getAttribute('title')).toBe('Donate to AMF');
  });

  it('updates the existing pill instead of duplicating', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, opts('first'));
    renderPill(target, opts('second', 'https://example.org/donate'));

    const pills = document.body.querySelectorAll('[data-p2i-pill]');
    expect(pills).toHaveLength(1);
    expect(pills[0]?.textContent).toBe('second');
    expect((pills[0] as HTMLAnchorElement).href).toBe('https://example.org/donate');
  });

  it('applies inline styles for isolation from page CSS', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, opts('x'));

    const style = target.nextElementSibling?.getAttribute('style') ?? '';
    expect(style).toContain('display:inline-block');
    expect(style).toContain('background:#fbbf24');
    expect(style).toContain('cursor:pointer');
    expect(style).toContain('text-decoration:none');
  });

  it('stops click propagation so an enclosing anchor is not also activated', () => {
    const outer = document.createElement('a');
    outer.href = 'https://parent-link.example/';
    let outerClicks = 0;
    outer.addEventListener('click', (e) => {
      e.preventDefault();
      outerClicks += 1;
    });
    const target = document.createElement('span');
    outer.append(target);
    document.body.append(outer);

    renderPill(target, opts('pill'));
    const pill = target.nextElementSibling as HTMLAnchorElement;
    pill.addEventListener('click', (e) => e.preventDefault());
    pill.click();

    expect(outerClicks).toBe(0);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:foo',
    'not a url at all',
    '',
  ])('refuses to render with unsafe href %s', (badHref) => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, { label: 'x', href: badHref });

    expect(target.nextElementSibling).toBeNull();
  });

  it('does not mistake an unrelated sibling for a pill', () => {
    const target = document.createElement('span');
    const sibling = document.createElement('span');
    sibling.textContent = 'unrelated';
    document.body.append(target, sibling);

    renderPill(target, opts('pill'));

    expect(target.nextElementSibling?.textContent).toBe('pill');
    expect(target.nextElementSibling?.nextElementSibling?.textContent).toBe('unrelated');
  });
});

describe('info card', () => {
  it('renders no card when options.card is absent', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, opts('label'));

    expect(target.nextElementSibling?.querySelector('.p2i-pill-card')).toBeNull();
  });

  it('renders a card child with title, subtitle, meta and CTA', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, {
      label: '🦟 ≈ 4.5 nets',
      href: HREF,
      card: {
        title: '🦟 Against Malaria Foundation',
        subtitle: '$24.99 ≈ 4.5 nets',
        meta: ['$5.50 per net', 'Source: GiveWell (as of 2025-01-01)'],
        cta: 'Click to donate $24.99 →',
      },
    });

    const pill = target.nextElementSibling as HTMLAnchorElement;
    const card = pill.querySelector('.p2i-pill-card');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('Against Malaria Foundation');
    expect(card?.textContent).toContain('$24.99 ≈ 4.5 nets');
    expect(card?.textContent).toContain('$5.50 per net');
    expect(card?.textContent).toContain('Click to donate $24.99 →');
  });

  it('card defaults to display:none in the inline style', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, {
      label: 'x',
      href: HREF,
      card: { title: 't', subtitle: 's', meta: [] },
    });

    const card = target.nextElementSibling?.querySelector('.p2i-pill-card');
    expect(card?.getAttribute('style')).toContain('display:none');
  });

  it('updates card content in place when re-rendering on the same anchor', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, {
      label: 'first',
      href: HREF,
      card: { title: 'Old', subtitle: 's1', meta: [] },
    });
    renderPill(target, {
      label: 'second',
      href: HREF,
      card: { title: 'New', subtitle: 's2', meta: [] },
    });

    const pills = document.body.querySelectorAll('[data-p2i-pill]');
    expect(pills).toHaveLength(1);
    expect(pills[0]?.textContent).toContain('New');
    expect(pills[0]?.textContent).not.toContain('Old');
  });

  it('treats card text as text content, not HTML (XSS guard)', () => {
    const target = document.createElement('span');
    document.body.append(target);

    renderPill(target, {
      label: 'safe',
      href: HREF,
      card: {
        title: '<img src=x onerror=alert(1)>',
        subtitle: 'x',
        meta: ['<script>alert(2)</script>'],
      },
    });

    const card = target.nextElementSibling?.querySelector('.p2i-pill-card');
    expect(card?.querySelector('img')).toBeNull();
    expect(card?.querySelector('script')).toBeNull();
    expect(card?.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('clearPills', () => {
  it('removes every pill from the tree', () => {
    document.body.innerHTML = `
      <span>$1</span><a class="p2i-pill" data-p2i-pill>a</a>
      <span>$2</span><a class="p2i-pill" data-p2i-pill>b</a>
    `;

    clearPills(document.body);

    expect(document.body.querySelectorAll('[data-p2i-pill]')).toHaveLength(0);
  });

  it('leaves non-pill elements alone', () => {
    document.body.innerHTML = `
      <span class="a-price">$5</span>
      <a class="p2i-pill" data-p2i-pill>x</a>
    `;

    clearPills(document.body);

    expect(document.body.querySelector('.a-price')).not.toBeNull();
  });
});
