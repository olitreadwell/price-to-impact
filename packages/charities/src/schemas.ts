/**
 * Zod schemas for runtime validation.
 *
 * Production code (web app, bookmarklet, extension) imports plain types
 * and data from `./` — the Zod runtime is *only* used by tests and any
 * caller that explicitly imports from `@price-to-impact/charities/schemas`.
 *
 * This is what keeps the bookmarklet IIFE around ~20 KB instead of
 * ~80 KB: tree-shaking can fully drop this file when it isn't imported.
 */

import * as z from 'zod';
import { CURRENCIES, type Currency } from './parsePrice';
import type { FxRate } from './fx';
import type { Charity } from './index';

export const CurrencySchema = z.enum(CURRENCIES);

export const FxRateSchema = z.object({
  currency: CurrencySchema,
  usdPerUnit: z.number().positive().finite(),
  asOf: z.iso.date(),
  source: z.string().min(1),
});

export const CharitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  unitPlural: z.string().min(1),
  costPerUnitUsd: z.number().positive().finite(),
  icon: z.string().min(1),
  donateUrl: z.url(),
  everyOrgSlug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  source: z.string().min(1),
  asOf: z.iso.date(),
});

// Compile-time assertions: the plain TS types in production files and
// the Zod schemas here must agree. If you change one without the other
// these casts will fail to compile.
type _CurrencyCheck = Currency extends z.infer<typeof CurrencySchema>
  ? z.infer<typeof CurrencySchema> extends Currency
    ? true
    : false
  : false;
type _FxRateCheck = FxRate extends z.infer<typeof FxRateSchema>
  ? z.infer<typeof FxRateSchema> extends FxRate
    ? true
    : false
  : false;
type _CharityCheck = Charity extends z.infer<typeof CharitySchema>
  ? z.infer<typeof CharitySchema> extends Charity
    ? true
    : false
  : false;

// One reference to each check so TS keeps them.
const _checks: [_CurrencyCheck, _FxRateCheck, _CharityCheck] = [true, true, true];
void _checks;
