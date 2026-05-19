'use client';

import { useMemo, useState } from 'react';
import {
  charities,
  convertPrice,
  formatUnits,
  parsePriceString,
  toUsd,
  type ParsedPrice,
} from '@price-to-impact/charities';
import { BookmarkletDragLink } from '@/components/BookmarkletDragLink';

const MAX_PRICE = 1_000_000;

/**
 * Accept either a fully-formed price string ("£99", "€1,234.56") or a bare
 * numeral (treated as USD). Returns null for anything that doesn't parse to
 * a positive finite value within the supported range.
 */
function parseInput(raw: string): ParsedPrice | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const parsed = parsePriceString(trimmed);
  if (parsed !== null && parsed.amount <= MAX_PRICE) return parsed;

  const bare = Number(trimmed);
  if (Number.isFinite(bare) && bare > 0 && bare <= MAX_PRICE) {
    return { amount: bare, currency: 'USD' };
  }
  return null;
}

export default function HomePage() {
  const [raw, setRaw] = useState('24.99');

  const parsed = useMemo(() => parseInput(raw), [raw]);
  const amountUsd = useMemo(() => {
    if (parsed === null) return null;
    return toUsd(parsed.amount, parsed.currency);
  }, [parsed]);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12 sm:py-16">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Price → Impact
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          See what a price could buy in high-impact charity. Today: AMF, Helen
          Keller, New Incentives, GiveDirectly.
        </p>

        <label className="mt-8 block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Price
          </span>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            <input
              type="text"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="$24.99 or £99 or €19,99"
              className="flex-1 bg-transparent text-lg text-zinc-900 outline-none dark:text-zinc-50"
              aria-label="Price (any currency)"
            />
          </div>
          {parsed === null && raw.trim() !== '' && (
            <span
              role="alert"
              className="mt-2 block text-xs text-red-600 dark:text-red-400"
            >
              Enter a positive amount (e.g. $24.99, £99, €19,99) up to 1,000,000.
            </span>
          )}
          {parsed !== null && parsed.currency !== 'USD' && amountUsd !== null && (
            <span className="mt-2 block text-xs text-zinc-500 dark:text-zinc-400">
              Detected {parsed.amount} {parsed.currency} → approx. $
              {amountUsd.toFixed(2)} USD (rate approximate, see About).
            </span>
          )}
        </label>

        <ul className="mt-8 space-y-4">
          {charities.map((charity) => {
            const units = amountUsd === null ? null : convertPrice(amountUsd, charity);
            return (
              <li
                key={charity.id}
                className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start gap-4">
                  <div aria-hidden="true" className="text-3xl leading-none">
                    {charity.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                        {charity.name}
                      </h2>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        ${charity.costPerUnitUsd.toFixed(2)} / {charity.unit}
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                      {units === null ? '—' : `≈ ${formatUnits(units, charity)}`}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Source: {charity.source} (as of {charity.asOf})
                    </p>
                    <a
                      href={charity.donateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Donate →
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <BookmarkletDragLink />
      </div>
    </main>
  );
}
