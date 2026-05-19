/**
 * Pure math for the round-up jar.
 *
 * Model: "coffee-jar" round-up. Each detected price `P` contributes
 * `ceil(P) - P` cents to a running jar — the change you'd get if you
 * paid the next round dollar. When the jar reaches the user's chosen
 * threshold (e.g. $10), it offers a 1-click donation of that
 * threshold; remaining cents carry over to the next round.
 *
 * Functions are deterministic — no Date, no Math.random, no I/O — so
 * the round-up flow is fully unit-testable.
 */

/**
 * Cents this price contributes to the jar.
 *
 * `ceil(priceUsd * 100) - priceUsd * 100`, with floating-point fuzz
 * compensated by rounding to integer cents at the input boundary. So
 *   9.34  → 66
 *   10.00 → 0
 *   9.999 → 1 (cents round to 1000, ceil stays at 1000, but the
 *               *next* dollar is 1100 in cents, contributing 1)
 *
 * Returns 0 for non-positive / non-finite input — those aren't real
 * prices and shouldn't bump the jar.
 */
export function jarContribution(priceUsd: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0;
  const cents = Math.round(priceUsd * 100);
  if (cents % 100 === 0) return 0;
  return 100 - (cents % 100);
}

export interface ThresholdState {
  /** True if the jar is at or past the threshold. */
  reachedThreshold: boolean;
  /** Dollar amount the user would donate this round. Always = threshold. */
  thresholdAmountUsd: number;
  /** Jar value after the user donates: jar - threshold (clamped at 0). */
  remainderAfter: number;
}

/**
 * Decide whether the jar has reached the threshold and what to do
 * if the user accepts the donation.
 */
export function thresholdState(roundupCents: number, thresholdCents: number): ThresholdState {
  const jar = Math.max(0, Math.floor(roundupCents));
  const threshold = Math.max(1, Math.floor(thresholdCents));
  return {
    reachedThreshold: jar >= threshold,
    thresholdAmountUsd: threshold / 100,
    remainderAfter: Math.max(0, jar - threshold),
  };
}

/**
 * Format jar progress for UI: `"$1.31 / $10.00"`. Clamps the visible
 * jar at the threshold so the popup never reads "$13.00 / $10.00".
 */
export function formatJarProgress(roundupCents: number, thresholdCents: number): string {
  const jar = Math.max(0, Math.min(roundupCents, thresholdCents));
  return `$${(jar / 100).toFixed(2)} / $${(thresholdCents / 100).toFixed(2)}`;
}
