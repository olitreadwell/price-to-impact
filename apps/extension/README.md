# Price → Impact — Chrome extension

Manifest V3 extension that annotates amazon.com prices with high-impact
charity equivalents. Phase 3 of the project (see top-level README).

## Architecture

- `manifest.json` — MV3 declaration. Content script matches `*://*.amazon.com/*`
  at `document_idle`.
- `src/content.ts` — runs once on load, then re-runs (debounced 250 ms) when
  the DOM mutates. Imports the Amazon detector and the pill renderer from
  `@price-to-impact/bookmarklet` so detection and rendering logic stay
  single-sourced with the bookmarklet workspace.
- `src/options.html` — static settings page (link to project for now).
- `build.ts` — Bun.build → `dist/content.js` + copies `manifest.json` and
  `options.html` into `dist/`.

## Develop

```sh
# From repo root:
bun --filter '@price-to-impact/extension' run build
```

Then in Chrome: `chrome://extensions` → "Load unpacked" → pick the
`apps/extension/dist/` directory.

## Status

Scaffold only. Known TODOs:
- Icons (`icons/icon-{16,48,128}.png`).
- `chrome.storage.sync` for user preferences (selected charity, etc.).
- Real options-page UI (currently a static info page).
- Support for non-USD Amazon locales once an FX module is wired.
