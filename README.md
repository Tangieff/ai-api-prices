# AI API Prices

A live AI inference price index for humans and agents.

Humans can search a model, compare every active provider's published input/output price per
million tokens and go straight to the provider. In a WebMCP-capable browser, an AI agent can
search, compare and cost workloads against the same normalized catalogue.

**Live: <https://ai-prices.oxweb.xyz>**

In a WebMCP-capable browser the same data is available to an AI agent as five callable
tools — see [Agent tools (WebMCP)](#agent-tools-webmcp). The challenge feature and demo
flow are summarized in [`CHALLENGE.md`](CHALLENGE.md).

---

## Quick start

Requires Node.js 20.9+ (developed on Node 22).

```bash
npm ci               # install the locked dependencies
npm run refresh-prices   # optional: fetch current prices (a dataset is committed)
npm run dev
```

A fresh point-in-time dataset is committed at `data/prices.json`, so a new clone renders the
current twelve-provider product without running a refresh first. Its `generated_at` value records
exactly when that public snapshot was observed.

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

  ok    surplus-intelligence: … offers
  ok    cometapi: … offers
  ok    relayrouter: … offers
  ok    tokenmix: … offers
  ok    relaygpu: … offers
  ok    midrelay: … offers

Wrote … offers across … models
  -> /path/to/data/prices.json
  12/12 providers ok in …s
```

Exit codes: `0` all providers succeeded · `1` at least one adapter failed (the dataset is still
written) · `2` no dataset could be written at all.

**A failing provider never blanks the site.** If an adapter errors or times out, its offers from the
previous run are carried forward, marked `stale` in the UI, and the error is recorded in
`provider_status`. Every other provider refreshes normally. The public page always renders the last
usable dataset.

Homepage and model-page HTML read `data/prices.json` dynamically on every request and use explicit
no-cache/no-store response headers. Already-open pages call `router.refresh()` every five minutes,
on a throttled foreground return, and after BFCache restoration, so a refresh appears without a
rebuild, app restart or manual browser reload.

## Providers

| Provider | Source | Adapter |
| --- | --- | --- |
| [Surplus Intelligence](https://www.surplusintelligence.ai/) | `api.surplusintelligence.ai/api/markets` | Public marketplace API |
| [CometAPI](https://www.cometapi.com/) | `cometapi.com/pricing/` | Public pricing-page parser |
| [MidRelay](https://midrelay.com/en) | `midrelay.com/en` | Public pricing-page parser |
| [TokenMix](https://tokenmix.ai/) | `api.tokenmix.ai/api/models` | Public paginated catalogue API |
| [RelayRouter](https://relayrouter.io/) | `relayrouter.io/models` | Public catalogue parser; explicit USD direct routes only |
| [RelayGPU](https://relaygpu.com/) | `relaygpu.com/pricing` | Public pricing-page parser |
| [ZenMux](https://zenmux.ai/) | `zenmux.ai/api/v1/models` | Public catalogue API; asserts the published unit and currency |
| [GPTProto](https://gptproto.com/) | `gptproto.com/model` | Public catalogue parser |
| [EvoLink](https://evolink.ai/) | `evolink.ai/pricing` | Public catalogue embedded in the pricing page |
| [OhMyGPT](https://www.ohmygpt.com/) | `www.ohmygpt.com/models` | Public catalogue parser; USD-priced routes only |
| [QuickSilver Pro](https://quicksilverpro.io/) | `quicksilverpro.io/pricing.json` | Public price file |
| [TeamoRouter](https://teamorouter.com/) | `teamorouter.com/pricing` | Public pricing-table parser; charged rate only |

These twelve curated active providers are read from live public sources without authentication. The
additional implemented adapters remain inactive: they do
not run, contribute rows or appear in public readouts. `src/lib/providers.ts` is the canonical
active registry and controls the refresh set.

## Adding a provider

1. Write `src/adapters/<provider>.ts` exporting an `Adapter` — a pure `parse*` function plus a thin
   fetch wrapper, so the parser can be tested against a synthetic fixture.
2. Add the implementation to `ALL_ADAPTERS` in `src/adapters/index.ts`.
3. Add the provider to `PROVIDERS` in `src/lib/providers.ts` only when it should become active.
4. Add a fixture under `tests/fixtures/` and a parser test.

`ADAPTERS` is derived from the active provider registry, so an implemented inactive adapter cannot
silently enter refreshes or public output. Model grouping, discounts, sorting and rendering remain
shared.

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
- **Separate inputs.** Provider adapters ingest the prices sellers publish. The independent
  `src/lib/official-prices.ts` registry contains model-maker baselines. Provider ingestion never
  creates or overrides an official baseline, and a provider's own reference field cannot create a
  public saving badge.
- **Featured models.** The broader normalized catalogue stays searchable. The default homepage
  shows at most six curated candidates and requires at least one active, fresh offer with complete
  input/output prices and a real saving against a comparable official baseline. It prefers models
  with qualifying offers from two or more providers and falls back through a deterministic curated
  list rather than weakening the gate.
- **Model grouping.** Providers spell the same model differently (`claude-opus-4.5`,
  `claude-opus-4-5-20251101`, `Claude Opus 4.5`). `src/lib/models.ts` folds these onto one slug by
  stripping vendor prefixes and date stamps and normalising version separators. Reasoning-effort
  variants (`-thinking`, `-high`) become a **tier** label on the same model, and are dropped when
  priced identically to the base row.
- **Money.** All arithmetic runs in integer micro-USD (`src/lib/money.ts`) so comparisons and
  percentages do not drift. All timestamps are UTC.
- **Referral links.** Each provider has an optional `affiliate_url`; `Visit` uses
  `affiliate_url ?? website_url`. Referral destinations are separate from ingestion and never
  affect ranking, cheapest flags, activation or visibility.

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
src/lib/providers.ts          canonical active-provider registry
src/lib/                      money, models, search, scoring, dataset, view model
src/lib/webmcp/               WebMCP tool surface for AI agents
src/refresh/run.ts            concurrent refresh with per-provider isolation
src/app/                      Next.js App Router page and components
tests/                        unit and parser tests, with synthetic fixtures
Dockerfile                    container targets for the app and one-shot refresh
docker-compose.yml            local container setup

```

## Configuration

No paid services are required. One optional variable:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_OXWEB_URL` | `https://oxweb.xyz` | Destination of the header's OXWeb link |

## Container usage

Build and run the application locally:

```bash
docker compose up -d --build
docker compose --profile refresh run --rm refresh
```

## License

[AGPL-3.0](LICENSE). If you run a modified version as a network service, you must offer
its source to your users. The one piece of material that is not ours to license, the
font, is listed in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md), which also
records why the test fixtures carry no third-party content.

Running your own instance? Replace or remove the referral links in `src/lib/referrals.ts`.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript, hand-written CSS, Vitest. Persistence is a single
generated JSON file — no database, queue or external service.

## Scope

This compares published prices and links out. It intentionally does **not** do provider trust
scores, audits, model-authenticity verification, accounts, payments, alerts or price history.
Prices change without notice; check the provider before committing spend.
