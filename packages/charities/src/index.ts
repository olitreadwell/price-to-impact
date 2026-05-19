import * as z from 'zod';

export * from './parsePrice';

export const CharitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  unitPlural: z.string().min(1),
  costPerUnitUsd: z.number().positive().finite(),
  icon: z.string().min(1),
  donateUrl: z.url(),
  source: z.string().min(1),
  asOf: z.iso.date(),
});

export type Charity = z.infer<typeof CharitySchema>;

// TODO(oliver): figures here are GiveWell-derived approximations and need a
// pre-launch verification pass against the current cost-effectiveness analysis
// at https://www.givewell.org/. The `asOf` field flags staleness in the UI.
export const charities: readonly Charity[] = z
  .array(CharitySchema)
  .min(1)
  .parse([
    {
      id: 'amf',
      name: 'Against Malaria Foundation',
      unit: 'net',
      unitPlural: 'nets',
      costPerUnitUsd: 5.5,
      icon: '🦟',
      donateUrl: 'https://www.againstmalaria.com/Donation.aspx',
      source: 'GiveWell cost-effectiveness analysis (approximate, see givewell.org)',
      asOf: '2025-01-01',
    },
    {
      id: 'helen-keller-vita',
      name: 'Helen Keller Intl — Vitamin A',
      unit: 'child reached',
      unitPlural: 'children reached',
      costPerUnitUsd: 2.5,
      icon: '👁️',
      donateUrl: 'https://www.hki.org/donate/',
      source: 'GiveWell cost-effectiveness analysis (approximate, see givewell.org)',
      asOf: '2025-01-01',
    },
    {
      id: 'new-incentives',
      name: 'New Incentives — Vaccination',
      unit: 'child fully vaccinated',
      unitPlural: 'children fully vaccinated',
      costPerUnitUsd: 8,
      icon: '💉',
      donateUrl: 'https://www.newincentives.org/donate',
      source: 'GiveWell cost-effectiveness analysis (approximate, see givewell.org)',
      asOf: '2025-01-01',
    },
    {
      id: 'give-directly',
      name: 'GiveDirectly — Cash Transfers',
      unit: 'USD delivered',
      unitPlural: 'USD delivered',
      costPerUnitUsd: 1.15,
      icon: '💵',
      donateUrl: 'https://www.givedirectly.org/give/',
      source: 'GiveDirectly published ~85% delivery efficiency (see givedirectly.org)',
      asOf: '2025-01-01',
    },
  ]);

export function convertPrice(priceUsd: number, charity: Charity): number {
  return priceUsd / charity.costPerUnitUsd;
}

export function formatUnits(count: number, charity: Charity): string {
  const rounded = count >= 10 ? Math.round(count) : Math.round(count * 10) / 10;
  const unit = rounded === 1 ? charity.unit : charity.unitPlural;
  return `${rounded} ${unit}`;
}
