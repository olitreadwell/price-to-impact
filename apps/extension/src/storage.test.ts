import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFS,
  __TEST_HELPERS,
  getPrefs,
  onPrefsChanged,
  setPrefs,
} from './storage';

const { STORAGE_KEY } = __TEST_HELPERS;

interface StorageChange {
  newValue?: unknown;
  oldValue?: unknown;
}

type ChangeListener = (
  changes: { [key: string]: StorageChange },
  area: string,
) => void;

function installFakeChrome() {
  const store: Record<string, unknown> = {};
  const listeners: ChangeListener[] = [];
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      sync: {
        async get(keyOrKeys: string | string[] | null) {
          if (keyOrKeys === null) return { ...store };
          const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
          const out: Record<string, unknown> = {};
          for (const k of keys) if (k in store) out[k] = store[k];
          return out;
        },
        async set(patch: Record<string, unknown>) {
          const changes: { [key: string]: StorageChange } = {};
          for (const [k, v] of Object.entries(patch)) {
            const oldValue = store[k];
            store[k] = v;
            changes[k] = { oldValue, newValue: v };
          }
          for (const l of listeners) l(changes, 'sync');
        },
      },
      onChanged: {
        addListener: (l: ChangeListener) => listeners.push(l),
        removeListener: (l: ChangeListener) => {
          const i = listeners.indexOf(l);
          if (i !== -1) listeners.splice(i, 1);
        },
      },
    },
  };
  return {
    seed: (value: unknown) => {
      store[STORAGE_KEY] = value;
    },
    clear: () => {
      delete store[STORAGE_KEY];
      listeners.length = 0;
    },
  };
}

let fakeChrome: ReturnType<typeof installFakeChrome>;

beforeEach(() => {
  fakeChrome = installFakeChrome();
});

describe('getPrefs', () => {
  it('returns defaults on first run (nothing persisted)', async () => {
    const prefs = await getPrefs();
    expect(prefs).toEqual(DEFAULT_PREFS);
  });

  it('reads back what was persisted', async () => {
    fakeChrome.seed({
      selectedCharityId: 'helen-keller-vita',
      paused: true,
      disabledHostnames: ['ebay.com'],
      hostnameCurrencyOverrides: { 'amazon.com.au': 'AUD' },
    });
    const prefs = await getPrefs();
    expect(prefs.selectedCharityId).toBe('helen-keller-vita');
    expect(prefs.paused).toBe(true);
    expect(prefs.disabledHostnames).toEqual(['ebay.com']);
    expect(prefs.hostnameCurrencyOverrides).toEqual({ 'amazon.com.au': 'AUD' });
  });

  it('coerces garbage shapes back to defaults rather than crashing', async () => {
    fakeChrome.seed({ paused: 'definitely-not-a-boolean', disabledHostnames: 99 });
    const prefs = await getPrefs();
    expect(prefs.paused).toBe(false);
    expect(prefs.disabledHostnames).toEqual([]);
  });

  it('drops unknown currency overrides via Zod check', async () => {
    fakeChrome.seed({ hostnameCurrencyOverrides: { 'ebay.com': 'XYZ', 'amazon.com.au': 'AUD' } });
    const prefs = await getPrefs();
    expect(prefs.hostnameCurrencyOverrides).toEqual({ 'amazon.com.au': 'AUD' });
  });

  it('lowercases disabledHostnames', async () => {
    fakeChrome.seed({ disabledHostnames: ['EBAY.com', 'Etsy.COM'] });
    const prefs = await getPrefs();
    expect(prefs.disabledHostnames).toEqual(['ebay.com', 'etsy.com']);
  });

  it('dedupes disabledHostnames (case-insensitively)', async () => {
    fakeChrome.seed({ disabledHostnames: ['ebay.com', 'eBay.com', 'EBAY.COM', 'etsy.com'] });
    const prefs = await getPrefs();
    expect(prefs.disabledHostnames).toEqual(['ebay.com', 'etsy.com']);
  });
});

describe('setPrefs', () => {
  it('persists a partial patch and returns the merged result', async () => {
    const next = await setPrefs({ paused: true, selectedCharityId: 'new-incentives' });
    expect(next.paused).toBe(true);
    expect(next.selectedCharityId).toBe('new-incentives');

    const reread = await getPrefs();
    expect(reread.paused).toBe(true);
    expect(reread.selectedCharityId).toBe('new-incentives');
    expect(reread.disabledHostnames).toEqual([]); // unchanged default
  });
});

describe('onPrefsChanged', () => {
  it('fires the handler with the sanitised new value', async () => {
    const spy = vi.fn();
    const unsubscribe = onPrefsChanged(spy);

    await setPrefs({ paused: true });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0].paused).toBe(true);

    unsubscribe();
    await setPrefs({ paused: false });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
