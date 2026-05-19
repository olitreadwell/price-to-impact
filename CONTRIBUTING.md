# Contributing to Price → Impact

Thanks for considering it. Below is the short version of what the
project expects.

## Quick start

```sh
git clone git@github.com:olitreadwell/price-to-impact.git
cd price-to-impact
bun install
bun run dev          # web converter at http://localhost:3000
bun run test         # 169 cases across three workspaces
bun run typecheck
bun run lint
bun run build
```

You'll need [Bun](https://bun.sh) 1.3+. Everything else (Node, npm) is
not needed — bun is the runtime, package manager, and bundler.

## Project shape (skim)

```
apps/
  web/          Next.js converter (paste price, see impact)
  bookmarklet/  IIFE bundle for the drag-link
  extension/    Chrome MV3 extension (the main product)
packages/
  charities/    Plain-data charities, FX, math, parser. No Zod at runtime.
docs/           Architecture + privacy + Web Store listing source
```

The extension is the lead. Web + bookmarklet are supporting surfaces.
See [`docs/architecture.md`](docs/architecture.md) for the data-flow.

## Filing an issue

Use one of the templates:

- **Bug** — concrete repro steps + surface + console logs
- **Feature** — lead with the user problem, not the implementation
- **Charity** — propose adding a charity with a sourced cost figure
- **Security** — open a [private advisory](https://github.com/olitreadwell/price-to-impact/security/advisories/new), not a public issue

Search existing issues first.

## Opening a PR

1. Branch off `main`.
2. Make atomic commits with [Conventional Commits](https://www.conventionalcommits.org/)
   prefixes: `feat(scope):`, `fix(scope):`, `chore(scope):`, `docs(scope):`, `test(scope):`, `refactor(scope):`.
3. Land tests for any non-trivial change. We use Vitest + happy-dom.
4. Run the gates locally:
   ```sh
   bun run lint && bun run typecheck && bun run test && bun run build
   ```
5. Open the PR using the template. Fill the skim layer (TL;DR, why,
   what's in, what's NOT). Add an "Engineering detail" `<details>`
   block for non-obvious decisions.

## Code conventions

Reading [AGENTS.md](https://github.com/olitreadwell/.claude/blob/main/AGENTS.md)
is the short version. Highlights:

- 2-space indent, single quotes, 80–100 char lines.
- Strict TypeScript. No `any`. No unused exports.
- 2-decimal numbers in UI; integer cents internally for currency math.
- Pure functions in `packages/charities` (no DOM, no storage). The
  extension consumes them; tests assert.
- DOM mutations go through `apps/bookmarklet/src/render.ts`. Never
  `innerHTML` user-influenced strings; `textContent` always.
- For Chrome runtime APIs: read prefs via `apps/extension/src/storage.ts`,
  never touch `chrome.storage.sync` directly from feature code.

## Adding a site detector

1. Create `apps/bookmarklet/src/detectors/<site>.ts` exporting a
   `Detector` (see [`src/types.ts`](apps/bookmarklet/src/types.ts)).
2. Register it in `apps/bookmarklet/src/detectors/registry.ts` ABOVE
   `genericDetector`.
3. Tests in `<site>.test.ts` using happy-dom + fixture HTML.
4. If the site is a new Amazon TLD, add it to the `TLD_TO_CURRENCY`
   map in `amazon.ts` and to `manifest.json` host permissions.

## Adding a charity

Use the [charity issue template](.github/ISSUE_TEMPLATE/charity.yml)
first to propose. PRs add:

- A new entry in the `charities` array in
  [`packages/charities/src/index.ts`](packages/charities/src/index.ts).
- A `donateUrlTemplate` (with `{amount}` placeholder) or accept the
  fallback `donateUrl` — see existing charities for patterns.
- Verify the cost figure against a CEA, not the charity's marketing.

## Scope discipline

A PR should:

- Touch only what its description says it touches
- Not refactor adjacent systems "while we're here"
- Not introduce abstractions for hypothetical future needs
- Three similar lines is better than a premature helper

## Security

If you find anything that could harm users (XSS, exfiltration, malicious
content-script behaviour), open a
[private security advisory](https://github.com/olitreadwell/price-to-impact/security/advisories/new)
instead of a public issue.

## License

By contributing, you agree your contributions are licensed under the MIT
license that covers this repo. See [LICENSE](LICENSE).
