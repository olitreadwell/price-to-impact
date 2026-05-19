/**
 * Typed wrapper around `chrome.storage.sync` for user preferences.
 *
 * `getPrefs()` always returns a fully populated object: missing fields
 * fall back to {@link DEFAULT_PREFS}, so callers never have to handle
 * "first run".
 *
 * Concurrency: `setPrefs(patch)` does read-modify-write under one
 * storage key, so two writers (popup and options open at the same
 * time) that fire near-simultaneous patches can race — last write
 * wins. Acceptable for our UI surface (single user, one decision per
 * click); revisit if anything ever batches.
 *
 * Future migrations should branch in `sanitise()` on a future
 * `version` field. We don't ship one yet to avoid version theatre.
 */

import { isCurrency, type Currency } from '@price-to-impact/charities';

/** Round-up threshold options in cents — what the user can choose between. */
export const THRESHOLDS_CENTS = [1000, 2000, 5000, 10000] as const;
export type ThresholdCents = (typeof THRESHOLDS_CENTS)[number];

/** Maximum number of history entries persisted. Older entries fall off the front. */
export const HISTORY_CAP = 200;

export interface HistoryEntry {
  /** ISO 8601 timestamp of the pill click. */
  ts: string;
  /** USD amount displayed on the price the user clicked. Two decimals. */
  usd: number;
  /** Charity id active at click time. */
  charityId: string;
  /** Hostname only (no path) — enough to label "Amazon" without leaking SKUs. */
  srcHost: string;
}

export interface Prefs {
  /** Charity id the user picked from `charities`. */
  selectedCharityId: string;
  /** Global kill switch — when true, the content script does nothing. */
  paused: boolean;
  /** Hostnames (lowercase, deduped) where the user disabled pill rendering. */
  disabledHostnames: readonly string[];
  /** Override the FX detection per hostname. Empty = use TLD default. */
  hostnameCurrencyOverrides: Readonly<Record<string, Currency>>;
  /** Cents accumulated in the round-up jar. Range: [0, activeThresholdCents). */
  roundupCents: number;
  /** Active threshold in cents — when jar reaches this, pills decorate. */
  activeThresholdCents: ThresholdCents;
  /** Intent-only log of pill clicks. Append-only, capped at HISTORY_CAP. */
  history: readonly HistoryEntry[];
}

export const DEFAULT_PREFS: Prefs = {
  selectedCharityId: 'amf',
  paused: false,
  disabledHostnames: [],
  hostnameCurrencyOverrides: {},
  roundupCents: 0,
  activeThresholdCents: 1000,
  history: [],
};

const STORAGE_KEY = 'p2i.prefs';

function sanitiseHostnames(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const lowered = raw
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.toLowerCase());
  return Array.from(new Set(lowered));
}

function sanitiseOverrides(raw: unknown): Readonly<Record<string, Currency>> {
  if (raw === null || typeof raw !== 'object') return {};
  const overrides: Record<string, Currency> = {};
  for (const [host, cur] of Object.entries(raw as Record<string, unknown>)) {
    if (isCurrency(cur)) overrides[host.toLowerCase()] = cur;
  }
  return overrides;
}

function sanitiseCharityId(raw: unknown): string {
  return typeof raw === 'string' && raw !== '' ? raw : DEFAULT_PREFS.selectedCharityId;
}

function sanitiseThreshold(raw: unknown): ThresholdCents {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_PREFS.activeThresholdCents;
  return (THRESHOLDS_CENTS as readonly number[]).includes(raw)
    ? (raw as ThresholdCents)
    : DEFAULT_PREFS.activeThresholdCents;
}

function sanitiseRoundupCents(raw: unknown, threshold: ThresholdCents): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  const floored = Math.max(0, Math.floor(raw));
  return floored >= threshold ? threshold - 1 : floored;
}

function sanitiseHistoryEntry(raw: unknown): HistoryEntry | null {
  if (raw === null || typeof raw !== 'object') return null;
  const e = raw as Partial<HistoryEntry>;
  if (typeof e.ts !== 'string' || e.ts === '') return null;
  if (typeof e.usd !== 'number' || !Number.isFinite(e.usd) || e.usd <= 0) return null;
  if (typeof e.charityId !== 'string' || e.charityId === '') return null;
  if (typeof e.srcHost !== 'string') return null;
  return {
    ts: e.ts,
    usd: Math.round(e.usd * 100) / 100,
    charityId: e.charityId,
    srcHost: e.srcHost.toLowerCase(),
  };
}

function sanitiseHistory(raw: unknown): readonly HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: HistoryEntry[] = [];
  for (const item of raw) {
    const entry = sanitiseHistoryEntry(item);
    if (entry !== null) entries.push(entry);
  }
  // Keep newest CAP — oldest entries (front) fall off when over budget.
  return entries.slice(Math.max(0, entries.length - HISTORY_CAP));
}

function sanitise(raw: unknown): Prefs {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_PREFS };
  const p = raw as Partial<Prefs>;
  const activeThresholdCents = sanitiseThreshold(p.activeThresholdCents);
  return {
    selectedCharityId: sanitiseCharityId(p.selectedCharityId),
    paused: typeof p.paused === 'boolean' ? p.paused : DEFAULT_PREFS.paused,
    disabledHostnames: sanitiseHostnames(p.disabledHostnames),
    hostnameCurrencyOverrides: sanitiseOverrides(p.hostnameCurrencyOverrides),
    roundupCents: sanitiseRoundupCents(p.roundupCents, activeThresholdCents),
    activeThresholdCents,
    history: sanitiseHistory(p.history),
  };
}

/** Read the user's preferences, filling in defaults. */
export async function getPrefs(): Promise<Prefs> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return sanitise(result[STORAGE_KEY]);
}

/** Patch a subset of preferences. Unset fields are preserved. */
export async function setPrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const current = await getPrefs();
  const next: Prefs = sanitise({ ...current, ...patch });
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  return next;
}

/**
 * Subscribe to preference changes. Fires on every cross-tab sync event
 * too, so a popup can write and a content script reads the new value
 * within one event loop turn.
 */
export function onPrefsChanged(handler: (prefs: Prefs) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (change === undefined) return;
    handler(sanitise(change.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Test-only seam: lets unit tests reset the persisted blob between cases. */
export const __TEST_HELPERS = { STORAGE_KEY, sanitise };
