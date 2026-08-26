# AI API Prices

A fast public comparison of what discount inference providers charge for popular AI models.

Search a model, see every provider's published input/output price per million tokens sorted
cheapest first, and go straight to the provider.

**Live: <https://ai-prices.oxweb.xyz>**

In a WebMCP-capable browser the same data is available to an AI agent as five callable
tools — see [Agent tools (WebMCP)](#agent-tools-webmcp). What was built for the OpenAI
WebMCP Challenge, and when, is set out in [`CHALLENGE.md`](CHALLENGE.md).

---

## Quick start

Requires Node.js 20.9+ (developed on Node 22).

```bash
npm install          # install dependencies
npm run refresh-prices   # optional: fetch current prices (a dataset is committed)
npm run dev
```

A generated dataset is committed at `data/prices.json`, so a fresh clone renders real prices
without running a refresh first.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (`npm run build` first) |
| `npm run refresh-prices` | Re-read every provider and rewrite `data/prices.json` |
| `npm run lint` | ESLint (fails on warnings) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + parser tests |
| `npm run check` | lint → typecheck → test → build, in one go |

To serve a production build locally:

```bash
npm run build
npm run start
```

## Refreshing prices

```bash
npm run refresh-prices
```

Each provider is read by its own adapter, concurrently and in isolation. Output looks like:

```
Refreshing provider prices…

  ok    surplus-intelligence: 181 offers
  ok    derouter: 12 offers
  ok    clawhive: 5 offers
  ok    worldgate: 26 offers
  ok    getgoapi: 116 offers

Wrote 340 offers across 259 models
  -> /path/to/data/prices.json
  5/5 providers ok in 2.0s
```

Exit codes: `0` all providers succeeded · `1` at least one adapter failed (the dataset is still
written) · `2` no dataset could be written at all.

**A failing provider never blanks the site.** If an adapter errors or times out, its offers from the
previous run are carried forward, marked `stale` in the UI, and the error is recorded in
`provider_status`. Every other provider refreshes normally. The public page always renders the last
usable dataset.

Homepage and model-page HTML read `data/prices.json` dynamically on every request and use private
no-cache/no-store response headers. Already-open pages call `router.refresh()` every five minutes,
on a throttled foreground return, and after BFCache restoration, so a refresh appears without a
rebuild, app restart or manual browser reload.

## Providers

| Provider | Source | Adapter |
| --- | --- | --- |
| [Surplus Intelligence](https://www.surplusintelligence.ai/) | `api.surplusintelligence.ai/api/markets` | Public marketplace API |
| [derouter.ai](https://derouter.ai/) | `derouter.ai/pricing` | Public pricing page parser |
| [ClawHive](https://clawhive.io/) | `clawhive.io/` | Public homepage parser |
| [WorldGate](https://worldgateapi.com/) | `worldgateapi.com/` | Public homepage parser |
| [GetGoAPI](https://getgoapi.com/) | `getgoapi.com/en/models` | Public catalogue parser |

All five are read from live public sources; none of them needs credentials.

WorldGate replaced ClaudeAPI.cheap in the launch set. `claudeapi.cheap` is a registered domain that
publishes no A, AAAA or CNAME record on either Google or Cloudflare public DNS, so it has no
reachable pricing page and could only ever have been a hand-maintained seed.

WorldGate's price cells carry the canonical USD figure in a `data-price-usd` attribute and a
rendered text price beside it. The adapter reads the attribute: the page's own script rewrites that
text on load, both to convert into the visitor's billing currency and because the server-rendered
text can lag the attribute.

## Adding a provider

1. Write `src/adapters/<provider>.ts` exporting an `Adapter` — a pure `parse*` function plus a thin
   fetch wrapper, so the parser can be tested against a captured fixture.
2. Add the provider to `PROVIDERS` in `src/lib/providers.ts`.
3. Register the adapter in `src/adapters/index.ts`.
4. Add a fixture under `tests/fixtures/` and a parser test.

Nothing else needs to change: model grouping, discounts, sorting and rendering are shared.

## How prices are compared

- **Sorting.** Within a model, offers sort by `input + 3 × output` per million tokens, computed in
  integer micro-USD. Output is weighted higher because it is priced several times above input; the
  score is an ordering rule, not a cost estimate. Offers missing a price are not comparable and sort
  last. See `src/lib/score.ts`.
- **Savings.** `Save vs official` uses one verified first-party model-maker standard API baseline
  per canonical model and the same `input + 3 × output` weighting as ranking. Provider-published
  reference fields remain diagnostic source data but do not control the public percentage. When a
  model or special tier has no like-for-like official baseline, the UI shows an explained `—`;
  prices at or above official never produce a saving badge.
- **Model grouping.** Providers spell the same model differently (`claude-opus-4.5`,
  `claude-opus-4-5-20251101`, `Claude Opus 4.5`). `src/lib/models.ts` folds these onto one slug by
  stripping vendor prefixes and date stamps and normalising version separators. Reasoning-effort
  variants (`-thinking`, `-high`) become a **tier** label on the same model, and are dropped when
  priced identically to the base row.
- **Money.** All arithmetic runs in integer micro-USD (`src/lib/money.ts`) so comparisons and
  percentages do not drift. All timestamps are UTC.
- **Referral links.** Each provider has an optional `affiliate_url`; `Visit` uses
  `affiliate_url ?? website_url`. All five are currently `null`, so links go to the provider site.

## Agent tools (WebMCP)

In a browser that supports [WebMCP](https://github.com/webmachinelearning/webmcp) — currently the
ChatGPT in-app browser, and Chrome/Edge behind the origin trial — the homepage registers five tools
on `document.modelContext`, so an AI agent can query the same normalised data a human reads instead
of scraping the DOM.

| Tool | Answers |
| --- | --- |
| `search_ai_model_prices` | "find model X", "which models are under $1 per million input tokens" |
| `compare_ai_model_providers` | "who is cheapest for GPT-5.6 Sol", "show me every provider for X" |
| `estimate_ai_workload_cost` | "what would 50M in and 10M out cost, and where is it cheapest" |
| `compare_ai_models` | "is Claude Opus 5 or GPT-5.6 Sol cheaper, for this workload" |
| `show_ai_prices_in_page` | leaves the answer on screen so the human can carry on browsing |

Try, in the ChatGPT in-app browser on <https://ai-prices.oxweb.xyz>:

1. `Find GPT-5.6 Sol and show me its cheapest providers.`
2. `Compare Claude Opus 5 and GPT-5.6 Sol for 50 million input and 10 million output tokens.`
3. `Which provider is cheapest for that workload, and how much is that off the official price?`
4. `Show me Anthropic models where some provider charges under $1 per million input tokens.`
5. `Put GPT-5.6 Sol on the page so I can keep browsing from there.`

Notes:

- **Progressive enhancement.** Everything is feature-detected. In a browser without WebMCP the
  component renders nothing and the site behaves exactly as before; there is no SSR or hydration
  effect either way.
- **One source of truth.** The tools reuse `buildPageData`, `lib/search`, `lib/score` and
  `lib/money`, so an agent cannot be told a different price from the one on screen. Providers whose
  last refresh failed are excluded by default and can never be reported as cheapest.
- **Exact money.** Workload costs are computed in integer micro-USD via BigInt, because
  `price_per_1m × tokens` overflows a double well before the token cap. Input and output are rounded
  separately so the published parts add up to the published total exactly.
- **Read-mostly and bounded.** Four tools are `readOnlyHint`; all four are `untrustedContentHint`,
  because provider prices are scraped third-party text. `show_ai_prices_in_page` can only set the
  existing search string and switch between the Models and Providers tabs — it cannot navigate.
- **Not a filter we can offer:** minimum context length. The dataset carries no context-window
  field, and inventing one would answer the question wrongly.

Implementation: `src/lib/webmcp/` (types, catalog, tools, registration) and
`src/app/components/WebMcpTools.tsx`. Tests: `tests/webmcp-*.test.ts`.

## Project layout

```
data/prices.json              generated dataset (committed)
scripts/refresh-prices.ts     the refresh command
src/adapters/                 one small independent adapter per provider
src/lib/                      money, models, search, scoring, dataset, view model
src/lib/webmcp/               WebMCP tool surface for AI agents
src/refresh/run.ts            concurrent refresh with per-provider isolation
src/app/                      Next.js App Router page and components
tests/                        unit and parser tests, with captured fixtures
Dockerfile                    production image: the server, and the refresh one-shot
docker-compose.yml            the stack, local only

```

## Configuration

No credentials or paid services are required. One optional variable:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_OXWEB_URL` | `https://oxweb.xyz` | Destination of the header's OXWeb link |

## Deployment

Build and run the application with environment-specific network settings supplied outside the repository:

```bash
docker compose up -d --build
docker compose --profile refresh run --rm refresh
```

Credentials, ingress configuration and operator procedures are intentionally not stored here.

## License

[AGPL-3.0](LICENSE). If you run a modified version as a network service, you must offer
its source to your users.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript, hand-written CSS, Vitest. Persistence is a single
generated JSON file — no database, queue or external service.

## Scope

This compares published prices and links out. It intentionally does **not** do provider trust
scores, audits, model-authenticity verification, accounts, payments, alerts or price history.
Prices change without notice; check the provider before committing spend.
