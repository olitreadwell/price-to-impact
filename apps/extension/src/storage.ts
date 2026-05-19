/**
 * Typed wrapper around `chrome.storage.sync` for user preferences.
 *
 * Schema is versioned via {@link PREFS_VERSION} so future migrations
 * have an obvious hook. The `getPrefs()` call always returns a fully
 * populated object: missing fields fall back to {@link DEFAULT_PREFS},
 * so callers never have to handle "first run".
 */

import { isCurrency, type Currency } from '@price-to-impact/charities';

/** Bumped when the schema changes in a way that needs migration. */
export const PREFS_VERSION = 1 as const;

export interface Prefs {
  /** Schema version of the persisted blob. */
  version: number;
  /** Charity id the user picked from `charities`. */
  selectedCharityId: string;
  /** Global kill switch — when true, the content script does nothing. */
  paused: boolean;
  /** Hostnames (lowercase) where the user disabled pill rendering. */
  disabledHostnames: readonly string[];
  /** Override the FX detection per hostname. Empty = use TLD default. */
  hostnameCurrencyOverrides: Readonly<Record<string, Currency>>;
}

export const DEFAULT_PREFS: Prefs = {
  version: PREFS_VERSION,
  selectedCharityId: 'amf',
  paused: false,
  disabledHostnames: [],
  hostnameCurrencyOverrides: {},
};

const STORAGE_KEY = 'p2i.prefs';

function sanitise(raw: unknown): Prefs {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_PREFS };
  const partial = raw as Partial<Prefs>;
  const overrides: Record<string, Currency> = {};
  if (partial.hostnameCurrencyOverrides && typeof partial.hostnameCurrencyOverrides === 'object') {
    for (const [host, cur] of Object.entries(partial.hostnameCurrencyOverrides)) {
      if (isCurrency(cur)) overrides[host.toLowerCase()] = cur;
    }
  }
  return {
    version: PREFS_VERSION,
    selectedCharityId:
      typeof partial.selectedCharityId === 'string' && partial.selectedCharityId !== ''
        ? partial.selectedCharityId
        : DEFAULT_PREFS.selectedCharityId,
    paused: typeof partial.paused === 'boolean' ? partial.paused : DEFAULT_PREFS.paused,
    disabledHostnames: Array.isArray(partial.disabledHostnames)
      ? partial.disabledHostnames
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.toLowerCase())
      : [],
    hostnameCurrencyOverrides: overrides,
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

/** Test seam: lets unit tests reset the persisted blob between cases. */
export const __INTERNAL = { STORAGE_KEY, sanitise };
