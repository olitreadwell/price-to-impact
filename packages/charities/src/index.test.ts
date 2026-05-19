import { describe, expect, it } from 'vitest';
import {
  charities,
  convertPrice,
  donateUrlForAmount,
  formatUnits,
  type Charity,
} from './index';
import { CharitySchema } from './schemas';

describe('charities data', () => {
  it('is non-empty', () => {
    expect(charities.length).toBeGreaterThan(0);
  });

  it('every entry validates against the schema', () => {
    for (const charity of charities) {
      expect(() => CharitySchema.parse(charity)).not.toThrow();
    }
  });

  it('every charity has a unique id', () => {
    const ids = charities.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('donateUrlForAmount', () => {
  const amf = charities.find((c) => c.id === 'amf')!;

  it('substitutes amount into the template, two decimals', () => {
    const charity: Charity = { ...amf, donateUrlTemplate: 'https://x.test/?a={amount}' };
    expect(donateUrlForAmount(charity, 24)).toBe('https://x.test/?a=24.00');
    expect(donateUrlForAmount(charity, 24.99)).toBe('https://x.test/?a=24.99');
  });

  it('falls back to charity.donateUrl when template is absent', () => {
    const fauxCharity: Charity = { ...amf, donateUrlTemplate: undefined };
    expect(donateUrlForAmount(fauxCharity, 24.99)).toBe(amf.donateUrl);
  });

  it('falls back when amount is non-positive or non-finite', () => {
    expect(donateUrlForAmount(amf, 0)).toBe(amf.donateUrl);
    expect(donateUrlForAmount(amf, -5)).toBe(amf.donateUrl);
    expect(donateUrlForAmount(amf, Number.NaN)).toBe(amf.donateUrl);
    expect(donateUrlForAmount(amf, Number.POSITIVE_INFINITY)).toBe(amf.donateUrl);
  });

  it('every shipped charity has a donateUrlTemplate', () => {
    for (const charity of charities) {
      expect(charity.donateUrlTemplate).toBeDefined();
    }
  });

  it('uses GiveDirectly native amountChosen URL', () => {
    const gd = charities.find((c) => c.id === 'give-directly')!;
    expect(donateUrlForAmount(gd, 24.99)).toBe(
      'https://donate.givedirectly.org/?amountChosen=24.99',
    );
  });

  it('uses the rich every.org URL pattern for AMF / HK / NI (straight to card confirm)', () => {
    for (const id of ['amf', 'helen-keller-vita', 'new-incentives']) {
      const c = charities.find((x) => x.id === id)!;
      const url = donateUrlForAmount(c, 24.99);
      expect(url).toContain('every.org/');
      expect(url).toContain('amount=24.99');
      expect(url).toContain('#/donate/card/confirm');
    }
  });
});

describe('convertPrice', () => {
  it('returns count of units that the price could buy', () => {
    const charity = charities[0]!;
    const count = convertPrice(charity.costPerUnitUsd * 4, charity);
    expect(count).toBeCloseTo(4);
  });

  it('returns fractional units for prices below one unit', () => {
    const charity = charities[0]!;
    expect(convertPrice(charity.costPerUnitUsd / 2, charity)).toBeCloseTo(0.5);
  });
});

describe('formatUnits', () => {
  const charity = charities[0]!;

  it('uses singular noun for exactly one unit', () => {
    expect(formatUnits(1, charity)).toBe(`1 ${charity.unit}`);
  });

  it('uses plural noun for counts other than one', () => {
    expect(formatUnits(2, charity)).toBe(`2 ${charity.unitPlural}`);
    expect(formatUnits(0, charity)).toBe(`0 ${charity.unitPlural}`);
  });

  it('rounds to nearest integer above ten', () => {
    expect(formatUnits(12.7, charity)).toBe(`13 ${charity.unitPlural}`);
  });

  it('keeps one decimal for fractional units below ten', () => {
    expect(formatUnits(3.45, charity)).toBe(`3.5 ${charity.unitPlural}`);
  });
});
