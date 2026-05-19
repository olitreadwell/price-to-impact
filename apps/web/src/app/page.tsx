'use client';

import { useMemo, useState } from 'react';
import * as z from 'zod';
import { charities, convertPrice, formatUnits } from '@price-to-impact/charities';

const PriceInputSchema = z.object({
  amount: z.number().positive().finite().max(1_000_000),
});

export default function HomePage() {
  const [raw, setRaw] = useState('24.99');

  const parsed = useMemo(() => {
    const amount = Number(raw);
    return PriceInputSchema.safeParse({ amount });
  }, [raw]);

  const amount = parsed.success ? parsed.data.amount : null;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12 sm:py-16">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Price → Impact
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          See what a price could buy in high-impact charity. Today: Against
          Malaria Foundation. More coming.
        </p>

        <label className="mt-8 block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Price (USD)
          </span>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-zinc-500 dark:text-zinc-400">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="flex-1 bg-transparent text-lg text-zinc-900 outline-none dark:text-zinc-50"
              aria-label="Price in USD"
            />
          </div>
          {!parsed.success && raw !== '' && (
            <span
              role="alert"
              className="mt-2 block text-xs text-red-600 dark:text-red-400"
            >
              Enter a positive number up to 1,000,000.
            </span>
          )}
        </label>

        <ul className="mt-8 space-y-4">
          {charities.map((charity) => {
            const units = amount === null ? null : convertPrice(amount, charity);
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
      </div>
    </main>
  );
}
