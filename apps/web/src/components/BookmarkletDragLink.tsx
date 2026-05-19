'use client';

import { useEffect, useRef } from 'react';
import { bookmarkletSource } from '@/generated/bookmarklet';

/**
 * Draggable bookmarklet anchor + demo prices.
 *
 * The href is a single inline IIFE (no remote script loads), so the
 * bookmarklet runs on pages with strict CSP. Clicking the link from this
 * page executes the bookmarklet against the demo prices below, which
 * carry the opt-in `data-p2i-mock-price` attribute the mock detector
 * looks for.
 *
 * React's JSX renderer strips `javascript:` URLs as an XSS mitigation,
 * so we set the href imperatively via a ref after mount. The drag
 * affordance and inner text render normally; only the href is deferred.
 */
export function BookmarkletDragLink() {
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (el === null) return;
    el.setAttribute('href', `javascript:${encodeURI(bookmarkletSource)}`);
  }, []);

  return (
    <section className="mt-12 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/50">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Try the bookmarklet
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Drag the button to your bookmarks bar. Visit any amazon.com product
        page and click it. Each price gets a 🦟 badge showing the impact.
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Click it here for a preview using the demo prices below.
      </p>

      <a
        ref={anchorRef}
        href="#"
        draggable
        aria-label="Price to Impact bookmarklet — drag to your bookmarks bar"
        className="mt-4 inline-block cursor-grab rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-amber-300 active:cursor-grabbing dark:text-zinc-900"
      >
        🦟 Price → Impact
      </a>

      <div className="mt-6 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Demo prices
        </p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-900 dark:text-zinc-50">
          <li>
            T-shirt: <span data-p2i-mock-price="9.99">$9.99</span>
          </li>
          <li>
            Headphones: <span data-p2i-mock-price="249">$249.00</span>
          </li>
          <li>
            Laptop: <span data-p2i-mock-price="1299">$1,299.00</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
