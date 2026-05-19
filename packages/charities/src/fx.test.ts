import { describe, expect, it } from 'vitest';
import { CURRENCIES } from './parsePrice';
import { fxRates, getFxRate, toUsd } from './fx';
import { FxRateSchema } from './schemas';

describe('fxRates', () => {
  it('covers every Currency the parser recognises', () => {
    for (const currency of CURRENCIES) {
      expect(fxRates.find((r) => r.currency === currency)).toBeDefined();
    }
  });

  it('every entry validates against FxRateSchema', () => {
    for (const rate of fxRates) {
      expect(() => FxRateSchema.parse(rate)).not.toThrow();
    }
  });

  it('USD rate is parity', () => {
    expect(getFxRate('USD')?.usdPerUnit).toBe(1);
  });
});

describe('toUsd', () => {
  it('returns the same amount for USD', () => {
    expect(toUsd(24.99, 'USD')).toBe(24.99);
  });

  it('multiplies by the rate for non-USD currencies', () => {
    const gbpRate = getFxRate('GBP')?.usdPerUnit ?? 0;
    expect(toUsd(100, 'GBP')).toBeCloseTo(100 * gbpRate);
  });
});
