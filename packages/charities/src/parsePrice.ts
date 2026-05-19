import * as z from 'zod';

/**
 * Currencies the parser recognises. Add new entries to {@link CURRENCY_TOKENS}
 * to extend support.
 */
export const CurrencySchema = z.enum([
  'USD',
  'GBP',
  'EUR',
  'NZD',
  'CAD',
  'AUD',
]);
export type Currency = z.infer<typeof CurrencySchema>;

/** A successfully parsed monetary value. */
export interface ParsedPrice {
  amount: number;
  currency: Currency;
}

/**
 * Ordered token list. Longest, most specific tokens come first so that, e.g.,
 * `NZ$` matches before `$`.
 */
const CURRENCY_TOKENS: readonly { readonly token: string; readonly currency: Currency }[] = [
  { token: 'US$', currency: 'USD' },
  { token: 'USD', currency: 'USD' },
  { token: 'NZ$', currency: 'NZD' },
  { token: 'NZD', currency: 'NZD' },
  { token: 'CA$', currency: 'CAD' },
  { token: 'CAD', currency: 'CAD' },
  { token: 'AU$', currency: 'AUD' },
  { token: 'AUD', currency: 'AUD' },
  { token: 'GBP', currency: 'GBP' },
  { token: '£', currency: 'GBP' },
  { token: 'EUR', currency: 'EUR' },
  { token: '€', currency: 'EUR' },
  { token: '$', currency: 'USD' },
];

/** Match a (possibly negative) number-shaped substring. */
const NUMERIC_RE = /-?\d[\d., \s]*\d|-?\d/;

function stripWhitespace(s: string): string {
  return s.replace(/[\s ]/g, '');
}

/**
 * Decide which character (`.` or `,`) is the decimal separator in `numeric`.
 * The returned character is the canonical decimal point; the *other* character
 * is treated as a thousands separator and stripped during normalisation.
 *
 * Rules:
 * - Both `.` and `,` present → the rightmost is the decimal.
 * - Neither present → no decimal; default to `.`.
 * - Exactly one separator with 1 or 2 digits after → that separator is decimal.
 * - Exactly one separator with 3 digits after → that separator is thousands.
 *   (Cents are conventionally 2 digits, so 3 trailing digits never means cents.)
 */
function detectDecimalSeparator(numeric: string): '.' | ',' {
  const lastDot = numeric.lastIndexOf('.');
  const lastComma = numeric.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    return lastDot > lastComma ? '.' : ',';
  }

  if (lastDot === -1 && lastComma === -1) return '.';

  const sep: '.' | ',' = lastDot !== -1 ? '.' : ',';
  const sepIdx = sep === '.' ? lastDot : lastComma;
  const after = numeric.slice(sepIdx + 1);

  if (/^\d{1,2}$/.test(after)) return sep;
  return sep === '.' ? ',' : '.';
}

function normaliseNumeric(numeric: string, decimal: '.' | ','): string {
  const stripped = stripWhitespace(numeric);
  if (decimal === '.') {
    return stripped.replace(/,/g, '');
  }
  return stripped.replace(/\./g, '').replace(',', '.');
}

function findCurrency(input: string): Currency | null {
  const upper = input.toUpperCase();
  for (const { token, currency } of CURRENCY_TOKENS) {
    if (upper.includes(token.toUpperCase()) || input.includes(token)) {
      return currency;
    }
  }
  return null;
}

/**
 * Parse a human-readable price string into a structured {@link ParsedPrice}.
 *
 * Returns `null` for any input that does not contain a recognisable number
 * and currency. Numbers without an explicit currency token are rejected to
 * avoid silently assuming USD on, e.g., bare numerals copied from a spec
 * sheet.
 *
 * @example
 * parsePriceString('$24.99')      // { amount: 24.99, currency: 'USD' }
 * parsePriceString('NZ$1,299.00') // { amount: 1299,  currency: 'NZD' }
 * parsePriceString('€19,99')      // { amount: 19.99, currency: 'EUR' }
 * parsePriceString('free')        // null
 */
export function parsePriceString(input: string): ParsedPrice | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const currency = findCurrency(trimmed);
  if (currency === null) return null;

  const match = trimmed.match(NUMERIC_RE);
  if (match === null) return null;

  const decimal = detectDecimalSeparator(match[0]);
  const normalised = normaliseNumeric(match[0], decimal);
  const amount = Number(normalised);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return { amount, currency };
}
