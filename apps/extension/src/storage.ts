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

export interface Prefs {
  /** Charity id the user picked from `charities`. */
  selectedCharityId: string;
  /** Global kill switch — when true, the content script does nothing. */
  paused: boolean;
  /** Hostnames (lowercase, deduped) where the user disabled pill rendering. */
  disabledHostnames: readonly string[];
  /** Override the FX detection per hostname. Empty = use TLD default. */
  hostnameCurrencyOverrides: Readonly<Record<string, Currency>>;
}

export const DEFAULT_PREFS: Prefs = {
  selectedCharityId: 'amf',
  paused: false,
  disabledHostnames: [],
  hostnameCurrencyOverrides: {},
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

function sanitise(raw: unknown): Prefs {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_PREFS };
  const p = raw as Partial<Prefs>;
  return {
    selectedCharityId: sanitiseCharityId(p.selectedCharityId),
    paused: typeof p.paused === 'boolean' ? p.paused : DEFAULT_PREFS.paused,
    disabledHostnames: sanitiseHostnames(p.disabledHostnames),
    hostnameCurrencyOverrides: sanitiseOverrides(p.hostnameCurrencyOverrides),
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
