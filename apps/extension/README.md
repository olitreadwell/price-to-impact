# Extension (placeholder)

Chrome MV3 extension — coming in phase 3. Will share charity data with `apps/web` via `packages/charities`.

Planned:

- Content script auto-runs on `*://*.amazon.com/*` at `document_idle`
- Selects `.a-price .a-offscreen`, falls back to regex on non-Amazon
- Inserts a 🦟 badge after each price; `MutationObserver` handles dynamic content
- Options page reuses the converter UI from `apps/web`
- `chrome.storage.sync` for preferences
