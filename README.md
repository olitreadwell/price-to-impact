# Price → Impact

Shop online, see what each price could buy in high-impact charity. v1 ships with the Against Malaria Foundation (🦟 nets); architecture is built to add more.

## Roadmap

- **Phase 0** — Charity data model (Zod-validated, single source of truth in `packages/charities`)
- **Phase 1** — Web converter app (`apps/web`): paste a price, see the conversion
- **Phase 2** — Bookmarklet: drag from the web app, annotates Amazon prices in place
- **Phase 3** — MV3 Chrome extension (`apps/extension`): same logic, auto-runs on page load

## Repo layout

```
apps/
  web/         Next.js converter app (phase 1)
  extension/   Chrome extension (phase 3) — placeholder
packages/
  charities/   Shared Zod schema + charity data
```

## Develop

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

Open <http://localhost:3000>.
