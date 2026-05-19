import { describe, expect, it } from 'vitest';
import { CurrencySchema } from './parsePrice';
import { fxRates, getFxRate, toUsd } from './fx';

describe('fxRates', () => {
  it('covers every Currency the parser recognises', () => {
    const currencies = CurrencySchema.options;
    for (const currency of currencies) {
      expect(fxRates.find((r) => r.currency === currency)).toBeDefined();
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
