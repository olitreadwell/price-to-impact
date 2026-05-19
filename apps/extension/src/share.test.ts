/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { share, type ShareParams } from './share';

const PARAMS: ShareParams = {
  url: 'https://example.test/donate',
  text: 'I turned $24.99 into ≈ 4.5 nets',
  title: 'Price to Impact',
};

function setNavigator(field: 'share' | 'clipboard', value: unknown): void {
  Object.defineProperty(navigator, field, {
    configurable: true,
    writable: true,
    value,
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  setNavigator('share', undefined);
  setNavigator('clipboard', undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('share()', () => {
  it('uses navigator.share when available', async () => {
    const navShare = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { share: typeof navShare }).share = navShare;

    const result = await share(PARAMS);

    expect(result).toBe('shared');
    expect(navShare).toHaveBeenCalledWith({
      title: PARAMS.title,
      text: PARAMS.text,
      url: PARAMS.url,
    });
  });

  it('returns "cancelled" if the user dismisses the share sheet', async () => {
    const abort = new Error('User cancelled');
    abort.name = 'AbortError';
    (navigator as unknown as { share: () => Promise<void> }).share = () =>
      Promise.reject(abort);

    const result = await share(PARAMS);
    expect(result).toBe('cancelled');
  });

  it('falls back to clipboard when navigator.share is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = {
      writeText,
    };

    const result = await share(PARAMS);

    expect(result).toBe('clipboard');
    expect(writeText).toHaveBeenCalledWith(`${PARAMS.text} ${PARAMS.url}`);
  });

  it('shows a "Copied to clipboard" toast after clipboard fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = {
      writeText,
    };

    await share(PARAMS);

    const toast = document.getElementById('p2i-share-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('Copied');
  });

  it('falls back to a failure toast when neither API is usable', async () => {
    const result = await share(PARAMS);

    expect(result).toBe('failed');
    const toast = document.getElementById('p2i-share-toast');
    expect(toast?.textContent).toContain(PARAMS.url);
  });

  it('falls back to clipboard if navigator.share rejects with a non-abort error', async () => {
    (navigator as unknown as { share: () => Promise<void> }).share = () =>
      Promise.reject(new Error('Permission denied'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = {
      writeText,
    };

    const result = await share(PARAMS);
    expect(result).toBe('clipboard');
    expect(writeText).toHaveBeenCalled();
  });
});
