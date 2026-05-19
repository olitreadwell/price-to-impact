import type { Currency } from './parsePrice';

/**
 * Approximate FX rate. Each rate expresses how many USD one unit of
 * `currency` buys. The values are quoted with an `asOf` date so the UI
 * can surface staleness — they are not live and not authoritative.
 */
export interface FxRate {
  currency: Currency;
  usdPerUnit: number;
  asOf: string;
  source: string;
}

// TODO(oliver): refresh before any production launch. Pull from a trusted
// daily-rate source or an FX API. asOf is the staleness signal.
// Shape is validated by the corresponding Zod schema in tests (./schemas).
export const fxRates: readonly FxRate[] = [
  { currency: 'USD', usdPerUnit: 1.0, asOf: '2025-01-01', source: 'parity' },
  { currency: 'GBP', usdPerUnit: 1.25, asOf: '2025-01-01', source: 'approximate, see xe.com' },
  { currency: 'EUR', usdPerUnit: 1.08, asOf: '2025-01-01', source: 'approximate, see xe.com' },
  { currency: 'NZD', usdPerUnit: 0.57, asOf: '2025-01-01', source: 'approximate, see xe.com' },
  { currency: 'CAD', usdPerUnit: 0.7, asOf: '2025-01-01', source: 'approximate, see xe.com' },
  { currency: 'AUD', usdPerUnit: 0.64, asOf: '2025-01-01', source: 'approximate, see xe.com' },
];

const RATES_BY_CURRENCY: Map<Currency, FxRate> = new Map(
  fxRates.map((rate) => [rate.currency, rate] as const),
);

/**
 * Convert `amount` denominated in `from` to USD using the static rate table.
 *
 * @throws If no rate is configured for `from`. Currencies recognised by
 *   `parsePriceString` are guaranteed to have rates, so callers wiring
 *   parser → converter never need a try/catch.
 */
export function toUsd(amount: number, from: Currency): number {
  const rate = RATES_BY_CURRENCY.get(from);
  if (rate === undefined) {
    throw new Error(`No FX rate configured for ${from}`);
  }
  return amount * rate.usdPerUnit;
}

/** Lookup the rate record for a given currency, e.g. to surface `asOf`. */
export function getFxRate(currency: Currency): FxRate | undefined {
  return RATES_BY_CURRENCY.get(currency);
}
