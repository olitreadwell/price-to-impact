/**
 * Share affordance — Web Share API with clipboard fallback.
 *
 * Web Share API is available on most mobile browsers and some recent
 * desktop builds. On desktop Chrome it's gated behind a user gesture
 * and may not be enabled at all — in that case we fall back to writing
 * the share message to the clipboard and showing a transient toast.
 */

export interface ShareParams {
  /** Source URL to display in the share message (the donation page or project URL). */
  readonly url: string;
  /** Pre-composed share text, e.g. "I just turned $24.99 into ≈ 4.5 nets via AMF". */
  readonly text: string;
  /** Optional title for the share sheet (mobile mostly). */
  readonly title?: string;
}

export type ShareResult = 'shared' | 'clipboard' | 'cancelled' | 'failed';

const TOAST_ID = 'p2i-share-toast';
const TOAST_STYLE = [
  'position:fixed',
  'bottom:24px',
  'right:24px',
  'z-index:2147483647',
  'padding:10px 14px',
  'background:#1f2937',
  'color:#f9fafb',
  'border-radius:6px',
  'box-shadow:0 6px 18px rgba(0,0,0,0.25)',
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  'font-size:13px',
  'font-weight:500',
  'opacity:0',
  'transition:opacity 200ms ease',
  'pointer-events:none',
].join(';');

function showToast(message: string, doc: Document = document): void {
  const existing = doc.getElementById(TOAST_ID);
  if (existing !== null) existing.remove();

  const toast = doc.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('style', TOAST_STYLE);
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  (doc.body ?? doc.documentElement).append(toast);

  // Force a layout flush so the opacity transition runs.
  void toast.offsetHeight;
  toast.style.opacity = '1';

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}

/**
 * Try to invoke the native share sheet. On rejection (user cancelled,
 * API missing, or call failed) fall back to clipboard + toast.
 *
 * Resolves to a string that the caller can log or assert in tests.
 */
export async function share(params: ShareParams): Promise<ShareResult> {
  const payload = { title: params.title, text: params.text, url: params.url };

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err) {
      // The user dismissed the sheet — not a failure, just nothing to do.
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') return 'cancelled';
      // Fall through to clipboard for any other rejection.
    }
  }

  const clipboardText = `${params.text} ${params.url}`.trim();
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(clipboardText);
      showToast('Copied to clipboard.');
      return 'clipboard';
    }
  } catch {
    /* fall through */
  }

  showToast('Could not share — copy this URL: ' + params.url);
  return 'failed';
}
