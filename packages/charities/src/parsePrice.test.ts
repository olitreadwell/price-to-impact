import { describe, expect, it } from 'vitest';
import { parsePriceString } from './parsePrice';

describe('parsePriceString', () => {
  describe('happy paths', () => {
    it.each([
      ['$24.99', { amount: 24.99, currency: 'USD' }],
      ['US$10', { amount: 10, currency: 'USD' }],
      ['10 USD', { amount: 10, currency: 'USD' }],
      ['$1,299.00', { amount: 1299, currency: 'USD' }],
      ['£99', { amount: 99, currency: 'GBP' }],
      ['£1,000', { amount: 1000, currency: 'GBP' }],
      ['€19,99', { amount: 19.99, currency: 'EUR' }],
      ['€1.234,56', { amount: 1234.56, currency: 'EUR' }],
      ['€19.99', { amount: 19.99, currency: 'EUR' }],
      ['NZ$1,234.56', { amount: 1234.56, currency: 'NZD' }],
      ['CA$24.99', { amount: 24.99, currency: 'CAD' }],
      ['AU$5', { amount: 5, currency: 'AUD' }],
      ['  $24.99  ', { amount: 24.99, currency: 'USD' }],
    ] as const)('parses %s', (input, expected) => {
      expect(parsePriceString(input)).toEqual(expected);
    });
  });

  describe('rejects', () => {
    it.each([
      [''],
      ['   '],
      ['free'],
      ['100'], // no currency
      ['$0'],
      ['$-5'],
      ['NaN'],
    ])('returns null for %s', (input) => {
      expect(parsePriceString(input)).toBeNull();
    });

    it('returns null for non-string input', () => {
      // @ts-expect-error intentional misuse
      expect(parsePriceString(null)).toBeNull();
      // @ts-expect-error intentional misuse
      expect(parsePriceString(undefined)).toBeNull();
    });
  });

  describe('locale edge cases', () => {
    it('treats trailing two-digit comma as cents when only separator', () => {
      expect(parsePriceString('$10,50')).toEqual({ amount: 10.5, currency: 'USD' });
    });

    it('treats dot as thousands when comma is rightmost', () => {
      expect(parsePriceString('€1.234,56')).toEqual({ amount: 1234.56, currency: 'EUR' });
    });

    it('treats comma as thousands when dot is rightmost', () => {
      expect(parsePriceString('$1,234.56')).toEqual({ amount: 1234.56, currency: 'USD' });
    });

    it('handles narrow no-break space between symbol and number', () => {
      expect(parsePriceString('$ 24.99')).toEqual({ amount: 24.99, currency: 'USD' });
    });
  });
});
