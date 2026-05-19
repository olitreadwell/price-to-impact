# Implementation plan — round-up, share, history, accessibility

> Built from SPEC.md. Six vertical slices, each landing as one
> reviewable commit with code + tests + manual-test checkpoint.
> Total wall-clock estimate: ~10 hours sequential, ~6 hours with
> subagent parallelism after the foundation lands.

## Dependency graph

```
                         ┌───────────────────────────────┐
                         │  Foundation: storage schema v2 │  (must land first)
                         └──────────────┬────────────────┘
                                        │
       ┌────────────────────────────────┼────────────────────────────────┐
       ▼                                ▼                                ▼
  ┌─────────────┐               ┌─────────────┐               ┌─────────────────┐
  │  Round-up   │               │   History   │               │  Accessibility  │
  │  (math +    │               │  (intercept │               │  (popup/options │
  │   UI hooks) │               │   + render) │               │   ARIA + focus) │
  └──────┬──────┘               └─────────────┘               └─────────────────┘
         │
         ▼
  ┌─────────────┐
  │   Share     │
  │  (depends   │
  │   on pill   │
  │   click     │
  │   hook)     │
  └─────────────┘
```

Foundation is one task. Round-up → Share is a 2-task chain (Share needs the click-hook from Round-up's content-script changes). History and Accessibility can run independently of either.

## Vertical-slice principle

Each task delivers ONE complete path:

- New module + its tests + the caller that exercises it
- No "scaffold first, wire later" — wiring always lands in the same commit

A task is done when:

1. Its code compiles, lints, typechecks
2. Its tests pass locally
3. Manual smoke-test against the loaded extension succeeds
4. Bundle size stays within budget (foundation defines headroom)

## Phase 0 — Foundation (must land first)

### Task F1: Storage schema v2 + sanitisers + tests

**Scope.** Extend `apps/extension/src/storage.ts`.

**Adds to `Prefs`:**
```ts
roundupCents: number;                  // [0, activeThresholdCents)
activeThresholdCents: 1000 | 2000 | 5000 | 10000;
history: readonly HistoryEntry[];      // append-only, capped at 200
```

**Adds new interface:**
```ts
interface HistoryEntry {
  ts: string;       // ISO 8601
  usd: number;      // 2 decimal places
  charityId: string;
  srcHost: string;  // hostname only
}
```

**Sanitisers (per existing pattern):**
- `sanitiseRoundupCents(raw, threshold)` — clamps to `[0, threshold)`, floor to integer cents
- `sanitiseThreshold(raw)` — only `1000 / 2000 / 5000 / 10000`, default `1000`
- `sanitiseHistory(raw)` — array, each entry shape-checked, capped at 200, newest-last

**Defaults:**
```ts
DEFAULT_PREFS = {
  ...existing,
  roundupCents: 0,
  activeThresholdCents: 1000,
  history: [],
};
```

**Helpers exported alongside the sanitiser:**
- `HISTORY_CAP = 200`
- `THRESHOLDS_CENTS = [1000, 2000, 5000, 10000] as const`

**Acceptance criteria.**
- [ ] All three new fields readable via `getPrefs()` with sensible defaults
- [ ] `setPrefs({ history: [...] })` honours the cap (trims oldest)
- [ ] Garbage in storage doesn't crash: a roundupCents of `'lol'` becomes `0`, a threshold of `42` becomes `1000`
- [ ] CharitySchema-equivalent shape-check for HistoryEntry in `./schemas`
- [ ] Existing 8 storage tests still pass
- [ ] +5 new tests covering each field's sanitisation + cap behaviour

**Verification.**
```sh
bun run typecheck
bun --filter '@price-to-impact/extension' run test    # 13 cases, all green
```

**Bundle impact estimate.** +0.3 KB to popup.js, content.js, options.js (new sanitisers tree-shake to nothing if a bundle doesn't use them, but storage.ts is shared).

---

## Checkpoint A — F1 merged

Before any Phase 1+ task starts:

- [ ] Load unpacked extension, open popup → no console errors
- [ ] Confirm `chrome.storage.sync.get('p2i.prefs')` in DevTools shows the three new fields with defaults
- [ ] All 4 workspaces typecheck

---

## Phase 1 — Round-up (3 tasks)

### Task R1: `packages/charities/src/roundup.ts` — pure math

**Scope.** New module. Zero DOM, zero storage, zero side effects.

**API:**
```ts
/** Cents this price contributes to the jar: ceil(P) - P, rounded to cents. */
export function jarContribution(priceUsd: number): number;

/**
 * Given current jar (cents) and active threshold (cents), return:
 * - reachedThreshold: true if jar >= threshold
 * - thresholdAmountUsd: dollar amount the user would donate
 * - remainderAfter: jar value to persist if they donate
 */
export function thresholdState(roundupCents: number, thresholdCents: number): {
  reachedThreshold: boolean;
  thresholdAmountUsd: number;
  remainderAfter: number;
};

/** Convenience: format jar progress for UI ("$1.31 / $10.00"). */
export function formatJarProgress(roundupCents: number, thresholdCents: number): string;
```

**Acceptance criteria.**
- [ ] `jarContribution(9.34) === 66`
- [ ] `jarContribution(10.00) === 0`
- [ ] `jarContribution(9.999) === 1` (cents floor handled)
- [ ] `thresholdState(1031, 1000) === { reachedThreshold: true, thresholdAmountUsd: 10, remainderAfter: 31 }`
- [ ] All-zero / boundary / large-amount tests
- [ ] No `Math.random`, no `Date.now` — fully deterministic

**Verification.**
```sh
bun --filter '@price-to-impact/charities' run test    # +10 new cases
```

**Bundle impact.** +0.2 KB to bundles that import roundup helpers.

---

### Task R2: Content script — bump jar on render, decorate when threshold met

**Scope.** `apps/extension/src/content.ts`.

**Changes:**
- After `renderAll` completes, sum `jarContribution(p.priceUsd)` over the rendered prices, write via `setPrefs({ roundupCents: currentPrefs.roundupCents + sum })`.
- If `thresholdState(...).reachedThreshold`, decorate rendered pills with a `🎯` glyph and switch href to `donateUrlForAmount(charity, thresholdAmountUsd)`.
- Title attribute changes to `Donate $10 (round-up jar full) to AMF`.
- After a threshold-met pill click, listen via `chrome.storage.onChanged` for the `roundupCents` going to 0/remainder → re-render to drop the decoration. (Or: optimistically decrement on click via event listener on pill.)

**Important: avoid double-counting.** The same `.a-price` element can render multiple times (MutationObserver). The current code uses idempotent `clearPills` + re-render. Solution: track per-page-load contribution with a `Set<Element>` keyed by `anchorEl`; only contribute on first-time-seen anchors.

**Acceptance criteria.**
- [ ] Loading a page with three prices `$3.40 / $9.34 / $19.95` bumps `roundupCents` by `60 + 66 + 5 = 131`
- [ ] Reloading the same page does NOT double-count (per-page Set survives within a single content-script lifetime)
- [ ] When `roundupCents >= activeThresholdCents`, every pill shows `🎯` and links to `donateUrlForAmount(charity, threshold)`
- [ ] Clicking a threshold-met pill drops jar to `roundupCents - threshold` (or 0 + carry remainder, per `thresholdState`)
- [ ] `prefs.paused === true` blocks jar bumps (no incrementing while paused)

**Verification.**
- Unit: new fixture tests in `content.test.ts` (we don't have one yet — create it with happy-dom env)
- Manual: load Amazon page → DevTools `chrome.storage.sync.get('p2i.prefs')` shows jar growing, decoration appears at threshold

---

### Task R3: Popup + options UI — show jar, allow reset, pick threshold

**Scope.** `apps/extension/src/popup/popup.{html,ts}` and `apps/extension/src/options/options.{html,ts}`.

**Popup additions:**
- New section above the charity dropdown:
  - Progress bar: filled proportion of `roundupCents / activeThresholdCents`
  - Text: `$X.XX of $Y.YY to next 🦟 donation`
  - "Reset" button (clears jar with confirm)
- Live update via existing `onPrefsChanged` subscription

**Options additions:**
- Below charity radio: a "Round-up threshold" radio group ($10 / $20 / $50 / $100)
- Selection persists `activeThresholdCents`

**Acceptance criteria.**
- [ ] Popup shows accurate jar / threshold ratio
- [ ] Reset clears jar to 0 and updates popup live
- [ ] Threshold change in options persists; popup re-renders with new denominator
- [ ] Threshold change does NOT scale existing jar — if jar is $1.31 and threshold moves $10 → $20, jar still $1.31 / $20.00

**Verification.**
- Manual: change threshold in options, watch popup, click reset, refresh page
- Bundle: popup.js + options.js each ≤ 10 KB

---

## Checkpoint B — round-up working

- [ ] Visit 2 Amazon pages, watch jar grow in popup
- [ ] Once jar > active threshold, see `🎯` on every Amazon pill
- [ ] Click a threshold pill, land on Every.org with $10 (or active threshold) pre-filled
- [ ] Reset works
- [ ] Toggle pause → jar stops growing → unpause → resumes

---

## Phase 2 — History (1 task, ~2 hr)

### Task H1: Intent log + options page table

**Scope.**

`apps/extension/src/content.ts`:
- Intercept pill click (event listener on document.body, delegated)
- Append `{ ts, usd, charityId, srcHost: window.location.hostname }` to `prefs.history`
- Use `setPrefs` (which already enforces the cap via `sanitiseHistory`)
- Do this BEFORE the browser follows the anchor — synchronous storage write returns a Promise we don't need to await; the page navigates regardless

`apps/extension/src/options/options.{html,ts}`:
- New "Donation history" section
- Table: Date / Amount / Charity / Source
- "Total intended" line above the table
- "Clear history" button with confirm

**Acceptance criteria.**
- [ ] Pill click logs an entry within 500 ms (visible via DevTools storage poke)
- [ ] Options page shows the last 50 entries, newest first
- [ ] "Total intended" sums the visible window in USD
- [ ] Clear button empties the array after confirm
- [ ] History older than the 200-cap silently falls off the front
- [ ] Honestly labelled: header reads "Intended donations" not "Donations"
- [ ] +4 tests: append, cap-trim, clear, hostname extraction

**Verification.**
```sh
bun --filter '@price-to-impact/extension' run test
# Manual: click 3 pills → options table shows 3 rows → total matches
```

---

## Checkpoint C — history works

- [ ] Click 5 pills, see 5 rows in options
- [ ] Clear → empty
- [ ] Click 201+ pills (or seed via DevTools) → only the most recent 200 persist

---

## Phase 3 — Share (1 task, ~2 hr)

### Task S1: `share.ts` + render hook + content-script wire

**Scope.**

`apps/extension/src/share.ts` — new module:
```ts
interface ShareParams {
  priceUsd: number;
  charity: { name: string; icon: string };
  unitsLabel: string;     // e.g. "4.5 nets"
  donateUrl: string;
}

/**
 * Opens the system share sheet with a templated message. Falls back
 * to writing to the clipboard and resolving with `'clipboard'` if
 * navigator.share isn't available or the user cancels.
 */
export async function share(params: ShareParams): Promise<'shared' | 'clipboard' | 'cancelled'>;
```

`apps/bookmarklet/src/render.ts` — add optional `onShare?: () => void` to `PillOptions`. When set, an `↗` icon appears in the pill. Tab-focusable, keyboard-activatable.

`apps/extension/src/content.ts` — when rendering a pill, pass `onShare: () => share({...})` so each pill has its own share button.

**Acceptance criteria.**
- [ ] Pill has a small `↗` icon, tab-focusable
- [ ] Clicking the icon does NOT navigate the pill anchor (`event.preventDefault()` + `event.stopPropagation()`)
- [ ] On Chrome desktop with no `navigator.share`: clipboard fallback + toast "Copied to clipboard"
- [ ] On Chrome with `navigator.share` (mobile or some desktop): system share sheet opens
- [ ] Share text: `"I just turned $24.99 into ≈ 4.5 nets via Against Malaria Foundation. Price → Impact, https://price-to-impact.vercel.app"`
- [ ] +3 tests: share() happy path, fallback, share-icon doesn't trigger pill navigation

**Verification.**
- Manual: Chrome desktop without share API → click icon → clipboard pasted
- Manual: tab to share icon, Enter → same behaviour

---

## Checkpoint D — share works

- [ ] Share icon visible on every pill
- [ ] Click icon → clipboard contains the templated message
- [ ] Pill itself still navigates to donate page
- [ ] Keyboard: Tab → focus icon → Enter → clipboard fires

---

## Phase 4 — Accessibility pass (1 task, ~1 hr)

### Task A1: ARIA + focus-visible across popup + options + pill

**Scope.**

`apps/extension/src/popup/popup.html`:
- Status `<div id="status">` gains `role="status" aria-live="polite"`
- `<input type="checkbox" class="switch" id="paused">` and `#site-enabled` gain `aria-label` + their handler updates `aria-checked` (native checkbox already does this, but verify announce-text reads right)
- Pause toggle: `aria-pressed` not needed if native checkbox; verify VoiceOver

`apps/extension/src/options/options.html`:
- Each `.charity-row` gets `aria-describedby` linking the cost + source divs
- "Re-enable" button on disabled-sites list gets `aria-label="Re-enable on ebay.com"`

CSS in both popup + options:
- `:focus-visible` outlines on `.switch`, `select`, `button`, custom `.charity-row` label

`apps/bookmarklet/src/render.ts`:
- Already injects `:focus-visible` styles — verify they're keyboard-reachable from a `Tab` press on an Amazon page

**Acceptance criteria.**
- [ ] Tabbing through popup: every focusable control has a visible ring
- [ ] Screen reader (VoiceOver one manual pass): announces "Paused, switch, off" and similar
- [ ] Lighthouse accessibility score for the web app: ≥ 95
- [ ] All controls reachable via keyboard only — no mouse needed for any setting

**Verification.**
- Manual VoiceOver pass on the popup + options page
- Lighthouse run on `localhost:3001` web app
- No new automated tests — accessibility is mostly markup, our existing tests cover behaviour

---

## Checkpoint E — accessibility validated

- [ ] Keyboard-only walkthrough of popup + options succeeds
- [ ] VoiceOver pass: read aloud, settings make sense
- [ ] Lighthouse a11y ≥ 95
- [ ] Pill on Amazon: Tab focuses it, Enter navigates

---

## Final checkpoint — all features shipped

- [ ] All 6 tasks merged, all CI green
- [ ] Extension repackaged: `bun --filter '@price-to-impact/extension' run package`
- [ ] Manual end-to-end on amazon.com (or amazon.com.au):
  - [ ] Pills render with hover + focus-visible
  - [ ] Jar grows in popup
  - [ ] Threshold-met pills decorate + deep-link to $X donation
  - [ ] Share icon copies to clipboard
  - [ ] Options page shows history table + threshold radio
  - [ ] All toggles keyboard-accessible
- [ ] Bundle sizes within budget (popup/options/content each ≤ 12 KB)

## Parallel execution variant

If we have multiple agents/workers after F1 lands:

- Agent A: Phase 1 (R1 → R2 → R3) — 3 hr
- Agent B: Phase 2 (H1) — 2 hr
- Agent C: Phase 4 (A1) — 1 hr

Phase 3 (Share) blocks on R2's content-script changes that wire the pill click handler. Can run after R2 lands, doesn't need R3.

Worktrees required for A + B + C since all three touch `content.ts` and `options.ts`. Conflict-prone areas:
- `content.ts`: R2 adds storage write loop, H1 adds click listener, A1 adds nothing (ARIA-only) — merge by section, low conflict
- `options.ts`: R3 adds threshold radio, H1 adds history table, A1 adds aria-describedby — all additive, sectioned

Recommend serial unless we hit a real time pressure.

## Risks + mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `chrome.storage.sync` 100 KB quota with 200 history entries | Low | Each entry ≤ 200 bytes serialised → max 40 KB. Plenty of headroom. |
| Double-counting on MutationObserver re-renders | Medium | Per-page-load `WeakSet<Element>` of contributed anchors (Task R2) |
| Share API behaviour across Chrome versions | Medium | Feature-detect; clipboard fallback always available |
| Round-up math edge cases (floating-point) | Low | Pure module is fully tested; integer-cents internal representation |
| Accessibility regressions in popup CSS | Low | `:focus-visible` is additive; existing visual styles preserved |

## Open questions (defer to user)

1. **Round-up math interpretation.** Coffee-jar (per-price round-up cents) confirmed in SPEC, but worth one more sanity check before R1 lands.
2. **Share content URL.** Currently the spec uses `https://price-to-impact.vercel.app` — but we haven't deployed the web app. Use the GitHub URL until Vercel is wired? Or leave as a TODO?
3. **Threshold radio in popup vs options.** Spec puts it in options to keep the popup tight. Confirm or move to popup if users want fast switching.
