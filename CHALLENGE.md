# OpenAI WebMCP Challenge

AI API Prices is a live AI inference price index for humans and agents. The challenge
contribution is a WebMCP tool surface that lets an AI agent search the catalogue, compare
providers and models, estimate workload costs, and hand the result back to the visible page.

**Live demo: <https://ai-prices.oxweb.xyz>**

## Existing project / Challenge contribution

AI API Prices existed before the Submission Period. The WebMCP integration was added
during it, and is the challenge contribution.

Both points are checkable in this repository's own history:

| | Commit | Date (UTC) |
| --- | --- | --- |
| State of the project before the challenge | `d2c87c57dcf5335a9098f0567e38de6ba5cd92da` | 2026-08-24 |
| WebMCP implementation | `18d9d9322a209a93b67174d675a4c69d661f6e8f` | 2026-08-26T13:48:30Z |

The second commit is titled *"feat: expose the price index to AI agents over WebMCP"*.
To read the boundary directly:

```bash
git log --date=iso-strict --pretty="%h %ad %s" d2c87c5..18d9d93
```

What the challenge added is the agent surface, and only that: the five WebMCP tools
listed below, and the handoff that puts an agent's answer back onto the page the person
is looking at. The price index itself — the providers, the normalisation, the ranking and
the site — is prior work.

## Why WebMCP fits this product

Price comparison is easier when an agent can query structured data instead of reading a table
visually. The WebMCP tools use the same normalized catalogue, freshness rules, ranking logic and
money arithmetic as the interface, so agent and human results stay aligned.

The integration is progressive enhancement. Browsers without WebMCP continue to receive the
ordinary comparison site, while supported browsers register five tools on
`document.modelContext`.

## Tools

| Tool | What it does |
| --- | --- |
| `search_ai_model_prices` | Finds models and applies price, vendor and freshness filters |
| `compare_ai_model_providers` | Ranks every comparable provider route for one model |
| `estimate_ai_workload_cost` | Calculates provider costs for an input/output token workload |
| `compare_ai_models` | Compares up to five models for the same workload |
| `show_ai_prices_in_page` | Opens a model or provider result in the visible interface |

## Technical design

- Tool definitions live in `src/lib/webmcp/tools.ts`; registration and teardown live in
  `src/lib/webmcp/register.ts`.
- The pure catalogue layer in `src/lib/webmcp/catalog.ts` reuses the product's existing model,
  search, scoring and dataset code.
- Workload costs use integer micro-USD arithmetic with `BigInt`, avoiding floating-point drift.
- Read tools are bounded and marked read-only. Provider text is treated as untrusted content.
- Stale provider rows are excluded by default and cannot be reported as the cheapest current
  option.
- One provider may publish several priced routes for a model. Summaries count distinct providers
  separately from route rows, while structured results preserve every route.

The current product refreshes twelve active providers from public pricing pages or catalogue APIs.
A committed point-in-time dataset makes the project runnable without a network refresh.

## Try it

Open <https://ai-prices.oxweb.xyz> in a WebMCP-capable browser and try:

1. `Find GPT-5.6 Sol and show me its cheapest providers.`
2. `Compare Claude Opus 5 and GPT-5.6 Sol for 50 million input and 10 million output tokens.`
3. `Which provider is cheapest for that workload, and how far below the official price?`
4. `Show me Anthropic models where some provider charges under $1 per million input tokens.`
5. `Put GPT-5.6 Sol on the page so I can keep browsing from there.`

## Run and verify

```bash
npm ci
npm run check
npm run dev
```

The WebMCP test suites cover registration, lifecycle, catalogue queries, workload arithmetic,
provider ordering, tiered routes and visible-page actions.
