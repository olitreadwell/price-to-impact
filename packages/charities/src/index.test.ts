import { describe, expect, it } from 'vitest';
import { charities, convertPrice, formatUnits } from './index';
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
