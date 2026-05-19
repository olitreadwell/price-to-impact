export * from './parsePrice';
export * from './fx';

/**
 * A high-impact charity entry. Shape is validated by `CharitySchema` in
 * `./schemas` — kept as a plain interface here so production bundles
 * don't pull in the Zod runtime.
 */
export interface Charity {
  id: string;
  name: string;
  unit: string;
  unitPlural: string;
  costPerUnitUsd: number;
  icon: string;
  /** Fallback "donate" page. Used if `everyOrgSlug` is missing. */
  donateUrl: string;
  /**
   * Optional Every.org nonprofit slug. When set, pills link to
   * `every.org/<slug>/donate?amount=<usd>` so the user lands on a
   * donate page with the exact USD amount pre-filled — closer to
   * a 1-click flow than the charity's own multi-step donate page.
   */
  everyOrgSlug?: string;
  source: string;
  asOf: string;
}

/**
 * Build a donate URL for a specific USD amount. Falls back to the
 * charity's own donate page when there's no Every.org slug or the
 * amount isn't a finite positive number.
 */
export function donateUrlForAmount(charity: Charity, usdAmount: number): string {
  if (
    charity.everyOrgSlug !== undefined &&
    Number.isFinite(usdAmount) &&
    usdAmount > 0
  ) {
    const amount = usdAmount.toFixed(2);
    return `https://www.every.org/${charity.everyOrgSlug}/donate?amount=${amount}&frequency=ONCE`;
  }
  return charity.donateUrl;
}

// TODO(oliver): figures here are GiveWell-derived approximations and need a
// pre-launch verification pass against the current cost-effectiveness analysis
// at https://www.givewell.org/. The `asOf` field flags staleness in the UI.
// Shape is asserted against `CharitySchema` in tests.
export const charities: readonly Charity[] = [
  {
    id: 'amf',
    name: 'Against Malaria Foundation',
    unit: 'net',
    unitPlural: 'nets',
    costPerUnitUsd: 5.5,
    icon: '🦟',
    donateUrl: 'https://www.againstmalaria.com/Donation.aspx',
    everyOrgSlug: 'against-malaria-foundation',
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
    everyOrgSlug: 'helen-keller-international',
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
    everyOrgSlug: 'new-incentives',
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
    everyOrgSlug: 'givedirectly',
    source: 'GiveDirectly published ~85% delivery efficiency (see givedirectly.org)',
    asOf: '2025-01-01',
  },
];

export function convertPrice(priceUsd: number, charity: Charity): number {
  return priceUsd / charity.costPerUnitUsd;
}

export function formatUnits(count: number, charity: Charity): string {
  const rounded = count >= 10 ? Math.round(count) : Math.round(count * 10) / 10;
  const unit = rounded === 1 ? charity.unit : charity.unitPlural;
  return `${rounded} ${unit}`;
}
