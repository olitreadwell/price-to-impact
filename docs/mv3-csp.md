# MV3 CSP notes

> Chrome Manifest V3 forbids extension code from running remotely-hosted
> JavaScript. The bookmarklet path is also blocked on sites that ship a
> strict CSP. Both constraints push us toward a single inline IIFE.

## The constraint

**Manifest V3** (`extension_pages` content security policy):

```
script-src 'self'; object-src 'self';
```

You cannot:
- Inject `<script src="https://...">` into a page from a content script.
- Use `eval()`, `new Function()`, or `setTimeout('code-string')`.
- Run code that was downloaded at runtime.

You can:
- Bundle all logic into the content script at build time.
- Use `chrome.scripting.executeScript({ files: [...] })` with bundled files.
- Mutate the page DOM however you want from the isolated world.

**Bookmarklets** are subject to the host page's CSP. A site that ships
`script-src 'self'` will block external script loads, but a
`javascript:` URL with inlined code still executes because the
bookmarklet is treated as a user gesture inside the address bar /
bookmarks bar context. Some hardened sites (e.g. github.com with the
old `unsafe-inline`-free policy) do refuse `javascript:` execution, but
amazon.com today allows it.

## How we comply

All shells use the **same self-contained bundle strategy**:

| Shell | Source bundled | Loaded how |
| --- | --- | --- |
| Bookmarklet | `apps/bookmarklet/src/index.ts` → IIFE string | Inlined into the drag-link `href` |
| Extension | `apps/extension/src/content.ts` → `dist/content.js` | MV3 content script declaration |
| Web | `apps/web` (whole Next.js app) | Standard Next bundle |

No code is downloaded at runtime. No `eval`. No remote scripts. Only the
charity data, the detector, and the renderer travel with each shell.

## Things that would break this

Do not add any of these without a CSP-friendly fallback:

- `eval()` or `new Function(str)` anywhere in `apps/bookmarklet` or
  `apps/extension`.
- Importing a library that uses dynamic code generation under the hood
  (some templating engines, older Zod versions, some date libs).
- Loading detector data, FX rates, or charity figures from a network
  fetch in the bookmarklet path. The data must compile in.
- Putting the bookmarklet bundle on a CDN and having the drag-link load
  it from there. Works on most sites today, breaks on strict-CSP sites
  and on any future hardening.

## Bundle size budget

The bookmarklet IIFE is **~78 KB minified** today, dominated by the Zod
runtime pulled in through `@price-to-impact/charities`. `javascript:`
URLs handle this fine on every modern browser (limits are in the MB
range), but trimming weight is a known followup:

- Pre-validate the `charities` array at build time, emit a plain JS
  array without the Zod runtime.
- Same for `fxRates`.
- Export a "lite" entry path from `packages/charities` for shells that
  don't need schema validation at runtime.

This is the single biggest optimisation available before we'd need
shadow-DOM tricks, code-splitting, or remote loading.
