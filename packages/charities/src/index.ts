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
  /** Fallback "donate" page. Used when no amount-aware flow applies. */
  donateUrl: string;
  /**
   * Native donate URL with a literal `{amount}` placeholder, e.g.
   * `https://donate.givedirectly.org/?amountChosen={amount}`. Used
   * first when present — native flows usually skip an intermediate
   * platform hop. The placeholder is replaced with the USD value to
   * two decimal places.
   */
  donateUrlTemplate?: string;
  /**
   * Every.org nonprofit slug. Used when no `donateUrlTemplate` is set
   * but the charity is on Every.org — pills link to
   * `every.org/<slug>/donate?amount=<usd>` for an amount-pre-filled
   * donate page.
   */
  everyOrgSlug?: string;
  source: string;
  asOf: string;
}

const AMOUNT_PLACEHOLDER = '{amount}';

/**
 * Build a donate URL for a specific USD amount.
 *
 * Priority:
 *   1. `donateUrlTemplate` — native flow, fewest steps for the user.
 *   2. `everyOrgSlug` — every.org universal donate page.
 *   3. `donateUrl` — charity's own (often multi-step) flow.
 *
 * Falls all the way back to `donateUrl` for non-positive or non-finite
 * amounts so a malformed price never produces a malformed URL.
 */
export function donateUrlForAmount(charity: Charity, usdAmount: number): string {
  const validAmount = Number.isFinite(usdAmount) && usdAmount > 0;
  if (!validAmount) return charity.donateUrl;

  const amount = usdAmount.toFixed(2);

  if (charity.donateUrlTemplate !== undefined) {
    return charity.donateUrlTemplate.replace(AMOUNT_PLACEHOLDER, amount);
  }
  if (charity.everyOrgSlug !== undefined) {
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
    donateUrlTemplate:
      'https://www.every.org/newincentives?frequency=once&amount={amount}&method=card&no_exit=1&designation=NI%20Donate%20Page&require_share_info=true&utm_campaign=donate-button&utm_source=newincentives&utm_medium=donate-button-0.4#/donate/card/confirm',
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
    donateUrlTemplate: 'https://donate.givedirectly.org/?amountChosen={amount}',
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
