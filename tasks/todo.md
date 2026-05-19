# Todo — round-up, share, history, accessibility

Each task is one reviewable commit. Tick the box when its acceptance
criteria in `plan.md` are all green and the corresponding checkpoint
is verified manually.

## Phase 0 — Foundation

- [ ] **F1** — Storage schema v2 + sanitisers + tests
  - `apps/extension/src/storage.ts` — new fields: `roundupCents`,
    `activeThresholdCents`, `history`
  - HistoryEntry interface + cap (200) + per-field sanitisers
  - +5 storage tests

→ **Checkpoint A**: extension loads, prefs object has new fields with defaults

## Phase 1 — Round-up

- [ ] **R1** — `packages/charities/src/roundup.ts` — pure math + tests
  - `jarContribution(priceUsd)`, `thresholdState(...)`, `formatJarProgress(...)`
  - +10 unit tests, fully deterministic

- [ ] **R2** — Content script jar bump + threshold pill decoration
  - Per-page `WeakSet<Element>` to avoid double-counting on observer re-renders
  - Threshold-met state: `🎯` glyph + `donateUrlForAmount(charity, threshold)` href
  - Respect `prefs.paused` (no jar growth while paused)
  - +happy-dom fixture tests

- [ ] **R3** — Popup jar UI + options threshold radio
  - Popup progress bar + reset button
  - Options $10 / $20 / $50 / $100 radio
  - Live updates via `onPrefsChanged`

→ **Checkpoint B**: jar grows on Amazon visits; threshold-met pills decorate; reset and threshold change work

## Phase 2 — History

- [ ] **H1** — Intent log + options page table
  - Content-script click delegation, append to `prefs.history`
  - Options table (date / amount / charity / source) with running total
  - "Clear history" button with confirm
  - "Intended donations" label (not "donations")
  - +4 tests

→ **Checkpoint C**: clicks log, table renders, clear empties

## Phase 3 — Share

- [ ] **S1** — `share.ts` + render hook + content-script wire
  - `share({priceUsd, charity, unitsLabel, donateUrl})` with Web Share API
    + clipboard fallback + toast
  - Pill gains optional `↗` share icon (tab-focusable, doesn't trigger anchor)
  - +3 tests

→ **Checkpoint D**: clipboard fallback works on Chrome desktop; pill nav still works

## Phase 4 — Accessibility

- [ ] **A1** — ARIA + focus-visible pass
  - Popup: `aria-live` status, focus rings on switches
  - Options: `aria-describedby` on radio rows
  - VoiceOver manual pass on macOS
  - Lighthouse a11y ≥ 95 on web app

→ **Checkpoint E**: keyboard-only walkthrough succeeds end-to-end

## Final

- [ ] **F-FINAL** — End-to-end verification + extension repackage
  - All CI green
  - Manual smoke on amazon.com / .com.au
  - `bun --filter '@price-to-impact/extension' run package` → fresh zip
  - Bundle budget check: popup/options/content each ≤ 12 KB

## Open questions awaiting answer (from plan.md)

1. Round-up math interpretation — coffee-jar confirmed?
2. Share URL — GitHub link or wait for Vercel deploy?
3. Threshold radio location — options page or popup?
