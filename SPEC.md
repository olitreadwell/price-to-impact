# SPEC — round-up, share, history, accessibility

> Four small features layered on the existing extension. Each ships
> independently; together they push the product from "see your impact"
> to "act on your impact." Designed so four tracks can land in parallel
> behind a single shared storage schema bump.

## Objective

| Feature | One-sentence outcome |
| --- | --- |
| Round-up | A coffee-jar counter accumulates the cents we rounded off each price; when it hits $10/$20/$50/$100 the pill turns green and offers a 1-click donation of the threshold amount. |
| Share | After clicking a pill, the user gets a one-tap "share what you donated" affordance via `navigator.share` (or clipboard fallback) so they can post it to a feed of choice. |
| History | Every pill click is logged locally (timestamp + USD + charity + source URL). Surfaced in the options page with a running total. Honestly labelled as "intended donations" since we cannot verify completion across origins. |
| Accessibility | A 1-hour audit on the existing popup, options page, and pill: focus-visible outlines on custom controls, `aria-live` on status, `aria-pressed` on toggle. No Radix dependency. |

## Assumptions I'm making

Surface these now or I'll proceed with them.

1. **Round-up arithmetic — "coffee-jar" model.** Each detected price `P` contributes `ceil(P) - P` cents to a running jar. When the jar reaches the next threshold (`$10` default), pill goes green; clicking it donates the threshold amount, jar drops by that amount (carry remainder). Threshold ladder is `[$10, $20, $50, $100]`, user can pick which is "active" in options.
2. **Round-up scope.** Counter accumulates from any price rendered as a pill (passive). Not only on click. Reset is manual from the popup.
3. **Share trigger.** A small "share" affordance appears on hover/long-press of a pill, and a one-time toast after the user's first pill click of the session. We do *not* try to detect actual donation completion (cross-origin, impossible).
4. **Share content.** `"I just turned a $24.99 [item] into 4.5 mosquito nets via @AMF — pill-by-pill, https://price-to-impact.vercel.app"` (or the eventual deployed URL). Web Share API where available, clipboard with toast fallback.
5. **History.** Append-only log; capped at the most recent 200 entries to stay under `chrome.storage.sync`'s 100 KB quota with headroom. Each entry ≤ 200 bytes serialised. Older entries fall off the end.
6. **Accessibility scope.** Audit and fix what's there. No Radix, no React-ification, no new component library. Wire ARIA properly, fix focus rings, test with VoiceOver once.

## Acceptance criteria

### Round-up

- [ ] Viewing a page with three prices `$3.40 / $9.34 / $19.95` adds `$0.60 + $0.66 + $0.05 = $1.31` to the jar.
- [ ] Popup shows: `Round-up jar: $1.31 of $10.00 to next 🦟 donation`.
- [ ] When jar ≥ active threshold, every pill on the page has a `🎯` glyph and clicking it deep-links to `donateUrlForAmount(charity, threshold)`.
- [ ] After threshold-click, jar deducts the threshold amount (keeps remainder). Counter persists across page navigations.
- [ ] User can reset the jar to $0 from the popup.
- [ ] User can change the active threshold in the options page (one of $10 / $20 / $50 / $100).

### Share

- [ ] After a pill click, a session-scoped flag is set; the next pill rendered shows a small `↗` share icon next to it (or in a corner of the pill).
- [ ] Clicking the share icon calls `navigator.share({ title, text, url })` if available, else copies to clipboard and shows a 2-second toast.
- [ ] Share content includes the USD amount, the charity name, the rounded "≈ N units" string.
- [ ] Share affordance is keyboard-accessible (Tab → Enter).
- [ ] Share never fires automatically — explicit user gesture only.

### History

- [ ] Every pill click appends an entry `{ ts: ISO, usd: number, charityId: string, srcHost: string }` to `prefs.history`.
- [ ] Options page renders the last 50 entries as a table (date · amount · charity · source domain).
- [ ] Options page shows a running total over the visible window: "Intended: $X across N donations."
- [ ] User can clear history from the options page (confirm prompt).
- [ ] History entries older than the 200-cap fall off the front silently.
- [ ] Persistence uses `chrome.storage.sync`; survives device sync.

### Accessibility

- [ ] Popup pause-toggle and per-site toggle: visible focus ring via `:focus-visible`.
- [ ] Popup status div: `aria-live="polite"` so screen readers announce "Saved."
- [ ] Popup pause toggle: `aria-pressed` state synced to the boolean.
- [ ] Options radio list: `aria-describedby` linking each row's `name`/`cost`/`source` divs.
- [ ] Pills: already have `aria-label`. Verify with VoiceOver that tabbing through Amazon prices announces "Donate $24.99 to Against Malaria Foundation, link, opens in new tab."
- [ ] Lighthouse accessibility score on the web app stays ≥ 95.

## Architecture — what gets touched

```
packages/charities/
  src/index.ts          + roundup helpers? (no — keep here, separate module)
  src/roundup.ts        NEW  jarFor(price), threshold helpers — pure math
  src/schemas.ts        +    PrefsSchema (new fields) lives here in tests
apps/extension/
  src/storage.ts        +    Prefs gains: roundupCents, activeThresholdCents,
                              history[], history cap = 200
  src/content.ts        +    onPriceRendered → bump jar; threshold-state
                              decoration on pills; pill click → push history
  src/popup/popup.html  +    Jar progress section, "reset" button
  src/popup/popup.ts    +    Jar render + live update via onPrefsChanged
  src/options/options.* +    Threshold radio, history table, clear button
apps/bookmarklet/
  src/render.ts         +    Optional `state: 'threshold-met'` decoration
                              (separate from share/history — those are
                              extension-only)
apps/web/
  src/app/page.tsx      none
```

Storage schema bump (one version, shared by all four tracks):

```ts
interface Prefs {
  // ...existing fields...

  /** Cents accumulated toward the next threshold. Range: [0, threshold). */
  roundupCents: number;
  /** Active threshold in cents. One of 1000, 2000, 5000, 10000. */
  activeThresholdCents: number;
  /** Intent-only log of pill clicks. Append-only, capped at HISTORY_CAP. */
  history: readonly HistoryEntry[];
}

interface HistoryEntry {
  /** ISO 8601 timestamp. */
  ts: string;
  /** USD amount of the price the user clicked the pill on. */
  usd: number;
  /** Charity id at click time. */
  charityId: string;
  /** Hostname only (no path) — enough to know "Amazon" without leaking SKUs. */
  srcHost: string;
}
```

## Parallel-execution plan

Four tracks. Each contracts with the storage schema bump that lands first.

**Foundation PR** (must land first, ~30 min):
- `storage.ts` adds the new fields with defaults
- `sanitise*` helpers for each new field
- Schema-test updates
- No UX change

**Track A — Round-up** (~3 hr):
- `packages/charities/src/roundup.ts` (pure math, fully tested)
- Content script: jar bump on each rendered pill, threshold-state on pills
- Popup: progress bar + reset button
- Options: threshold radio

**Track B — Share** (~2 hr):
- `render.ts`: optional share-affordance hook
- New `apps/extension/src/share.ts`: `share({ usd, charity, units })` with Web Share API + clipboard fallback
- Content script: session flag, wire the affordance

**Track C — History** (~2 hr):
- Content script: push to history on pill click (intercept the anchor click)
- Options page: history table + running total + clear button

**Track D — Accessibility** (~1 hr):
- Popup HTML: `:focus-visible`, `aria-live`, `aria-pressed`
- Options HTML: `aria-describedby`
- Manual VoiceOver pass; record findings as new TODOs if any

Tracks A/B/C all read the same content-script render loop but only one writes to it per cycle (round-up decorates, share renders an icon, history listens). Touchpoints in `content.ts` need ordering: storage-write last, so a thrown share path doesn't lose the history entry.

## Inheritance from the existing repo

| Concern | Source of truth |
| --- | --- |
| Build / dev / test commands | Existing root `package.json` (`bun run dev / build / test / typecheck / lint`) |
| Project layout | `docs/architecture.md` |
| Code style | `AGENTS.md` / `CLAUDE.md` (2-space, single quotes, strict TS, no `any`) |
| Testing strategy | Existing: Vitest with happy-dom envs; new pure-math modules get full coverage; new content-script logic gets fixture-driven tests against happy-dom |
| Boundaries | `docs/mv3-csp.md` — no remote-hosted code, no `eval`, sub-100 KB bundles |

## Boundaries

### Always do
- Pure functions (round-up math, share content composition) in `packages/charities` so all three shells share.
- Persist via `setPrefs` only; never touch `chrome.storage.sync` directly from feature code.
- Append-only history with a hard cap — never let storage hit the 100 KB quota.
- Honour `prefs.paused` — every feature stops when the user pauses.

### Ask first about
- Any cross-origin fetch (we have none today; would need a manifest permissions update).
- Any new third-party dependency over 5 KB minified.
- Any change that drops bundle size budget under 50 KB headroom.

### Never do
- Telemetry / analytics. The privacy policy promises zero data exfiltration.
- Auto-trigger share on donation completion (impossible cross-origin; would be misleading UX).
- Pretend history is "verified donations" — always labelled "intended."
- Add Radix / React to the extension popup or options page.

## Verification (what "done" looks like for the whole spec)

```
bun run lint
bun run typecheck
bun run test          # all 4 workspaces green
bun run build         # web app + bookmarklet bundle + extension dist
bun --filter '@price-to-impact/extension' run package
```

Plus manual:
- Load unpacked extension in Chrome
- Visit Amazon, see pills with round-up state
- Click a pill, see share toast
- Open options, see history table
- Tab through popup with keyboard, confirm focus rings visible

## One question

**Round-up arithmetic — coffee-jar (assumption 1) or full-price aggregation?** If "round-up to near dollar values" meant something different (e.g., aggregate the *full* viewed prices until the total clears a threshold), the math and the UX both shift. The spec assumes coffee-jar — confirm or correct before I write the math module.
