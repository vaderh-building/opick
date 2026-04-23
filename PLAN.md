# OPick V6 Frontend Upgrade — Plan

## Stack reality check

The existing frontend is **Vite + React 19 + React Router v7**, not Next.js. Plan accommodates that:
- Env vars use the `VITE_` prefix. We'll accept `VITE_ORACLE_URL` primarily and also read `NEXT_PUBLIC_ORACLE_URL` as a fallback (per spec). Document both in `.env.example`.
- Routing via `react-router-dom` (`BrowserRouter`), not `app/` directory.

## New files to create

### Components (`frontend/src/components/v6/`)
- `Masthead.jsx` + `.module.css` — top bar: OPICK wordmark, ATTENTION INDEX small caps center, issue number right, hairline rule below. Wallet connect button at far right.
- `SmallCapsLabel.jsx` + `.module.css` — small caps letter-spaced label.
- `SubjectName.jsx` + `.module.css` — Playfair Italic, variants `large | medium | small`.
- `IndexNumber.jsx` + `.module.css` — JetBrains Mono with comma formatting, `display | inline`.
- `TombstoneTable.jsx` + `.module.css` — label / value rows with hairline rules.
- `Sparkline.jsx` — thin SVG line chart.
- `HairlineRule.jsx` — 1px divider.
- `EditorialCard.jsx` + `.module.css` — three-column container, responsive stack.
- `LiveTimestamp.jsx` — updating JetBrains Mono UTC clock.
- `PulsingDot.jsx` + `.module.css` — small live indicator.
- `TradeGateModal.jsx` + `.module.css` — email-capture modal shown when trade buttons are clicked pre-oracle-live.

### Pages (`frontend/src/pages/v6/`)
- `HomeV6.jsx` + `.module.css` — Home `/`.
- `SubjectPage.jsx` + `.module.css` — `/subjects/:slug`.
- `MarketV6Editorial.jsx` + `.module.css` — `/markets/:id`.
- `AboutPage.jsx` + `.module.css` — `/about`.
- `LegacyPage.jsx` + `.module.css` — `/legacy`.

### Data layer (`frontend/src/lib/`)
- `mockData.js` — 10 subjects (Musk, Altman, Trump, Taylor Swift, SBF, OpenAI, xAI, Tesla, Polymarket, Bitcoin) with realistic metrics + a handful of mock markets. Factual bios only (birth year, role, tracked-since).
- `oracle.js` — fetch wrappers that branch on env var; returns mock data if no URL or `VITE_USE_MOCK=true`.

### Hooks (`frontend/src/hooks/`)
- `useSubjects.js` — subject list + lookup by slug.
- `useAttentionMarkets.js` — market list + lookup by id (renamed from `useMarkets` to avoid collision; old hook stays for legacy page).

### API route
- `frontend/api/newsletter.js` — simple file-backed POST handler used by dev server; persists to `newsletter_signups.json` in project root. Since this is Vite (not Next), we'll add a tiny Vite middleware plugin in `vite.config.js` to expose `/api/newsletter` during dev, and also write a vercel.json rewrite note for production. (No cloud deploy expected in this task.)

### Misc
- `frontend/.env.example` — documents `VITE_ORACLE_URL`, `VITE_USE_MOCK`, `VITE_PRIVY_APP_ID`.
- `PLAN.md` (this file).

## Files to modify

- `frontend/src/App.jsx` — replace routes:
  - `/` → `HomeV6`
  - `/subjects/:slug` → `SubjectPage`
  - `/markets/:id` → `MarketV6Editorial` (new V6 editorial market)
  - `/about` → `AboutPage`
  - `/legacy` → `LegacyPage`
  - `/market/:address` → redirect to `/legacy`
  - `/markets` (old V5 list) → redirect to `/`
  - Keep Privy-auth routes (`/account`, `/portfolio`) reachable from legacy but hidden from main nav.
  - Replace `<Navbar>` with `<Masthead>` at layout level.
  - Keep `<Footer>` only on legacy pages; V6 pages have their own editorial footer.
- `frontend/src/index.css` — add V6 tokens: `--near-black #1a1a1a` per spec, tighten base font sizes, add utility classes for small-caps, remove any remaining border-radius > 4px defaults.
- `frontend/index.html` — update `<title>` to "OPick — Attention Index" and OG meta to match V6 narrative.
- `frontend/vite.config.js` — add middleware plugin for dev-time `/api/newsletter` endpoint.

## Files to leave alone

- `contracts/`, `contracts/v6/`, `opick-oracle/` — untouched.
- `frontend/src/pages/MarketPage.jsx` (V5 market UI) — kept as-is but only reachable from `/legacy` deep links (we won't route to it by default; old `/market/:address` redirects to `/legacy`).
- `frontend/src/pages/MarketV6.jsx` — the previous V6 trading page remains accessible at `/v6/m/:address` for continuity, but not linked from new nav. Once real V6 markets exist, we'll unify later.
- Existing hooks (`useMarkets`, `useV6Markets`, `useWallet`, `useSponsoredTx`, etc.) — preserved.
- `Navbar`, `Footer` — kept in repo; just not rendered on V6 pages.

## Files to remove

- None. We preserve V5 artifacts per spec ("do not break V5 market pages entirely").

## Routing summary

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `HomeV6` | New home |
| `/subjects/:slug` | `SubjectPage` | Dossier |
| `/markets/:id` | `MarketV6Editorial` | Editorial market page |
| `/about` | `AboutPage` | Long-form editorial |
| `/legacy` | `LegacyPage` | V5 archive list |
| `/legacy/market/:address` | `MarketPage` (V5) | Preserved deep links |
| `/market/:address` | redirect → `/legacy` | V5 cleanup |
| `/markets` | redirect → `/` | V5 list removed |
| `/account`, `/portfolio`, `/u/:username`, `/create`, `/create/v6`, `/v6/m/:address`, `/amplifier`, `/developers`, `/docs`, `/terms`, `/privacy`, `/risk` | existing | Preserved without nav linkage |

## Quality checks before declaring done

- `pnpm dev` (falls back to `npm run dev`) starts cleanly.
- Routes visited: `/`, `/subjects/elon-musk`, `/markets/musk-altman-density`, `/about`, `/legacy`. Zero console errors.
- Responsive sweep at 375px on each route.
- Grep the codebase for em dashes in new copy (none permitted), emojis (none), `box-shadow` (none in new CSS).
- All buttons / links have visible focus state; text contrast passes AA.
- Lighthouse accessibility ≥ 90 spot-checked on home.

## Commits

1. `v6: scaffold routes and component library` — components, empty pages, route wiring, env template.
2. `v6: implement home and subject dossier with mock data` — populated `HomeV6`, `SubjectPage`, `mockData`, hooks.
3. `v6: implement market detail, about, legacy, and mobile polish` — `MarketV6Editorial`, `AboutPage`, `LegacyPage`, responsive refinements, trade gate modal.

## Follow-up TODOs for user (post-review)

1. Swap hardcoded subject bios for a CMS or JSON-backed source of truth.
2. Point `VITE_ORACLE_URL` at the production oracle domain once deployed.
3. Add real portrait photography (licensed) for subject dossiers.
4. Wire V6 contract trading on `/markets/:id` once factory is live.
5. Add OG image generation per subject.
6. Consider migrating to Next.js if SEO / static export matters for editorial surfaces.
