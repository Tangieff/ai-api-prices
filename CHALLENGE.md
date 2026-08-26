# OpenAI WebMCP Challenge — what is new here

AI API Prices existed before the challenge. This file separates the prior work from the
work added during the Submission Period, because the rules evaluate a pre-existing project
only on what was added after the start.

**Submission Period start:** 2026-08-25, 11:00 PT (2026-08-25T18:00Z).

## Prior work (before the Submission Period)

The price-comparison product itself: 18 provider adapters, the canonical model/price
normalisation, the ranking rule, the official-price baselines, the homepage and model
pages, and the deployment. First commit `a80e5cd`, 2026-08-20. The last commit before the
Submission Period opened is `2d5db54`, 2026-08-25T13:25Z.

None of that is offered as challenge work.

## Work added during the Submission Period

The WebMCP agent-tool surface, and only that.

| Commit | UTC timestamp | What |
| --- | --- | --- |
| [`5d23fa7`](../../commit/5d23fa7) | 2026-08-26T13:48:30Z | `feat: expose the price index to AI agents over WebMCP` |
| [`34cef69`](../../commit/34cef69) | 2026-08-26T14:05:48Z | Merge PR #37, *Add WebMCP agent tools* |

Both are ~20 hours after the Submission Period opened. The diff is 13 files,
+2431/-2 lines:

```
src/lib/webmcp/types.ts          WebMCP typings + feature detection
src/lib/webmcp/catalog.ts        pure query and costing layer
src/lib/webmcp/tools.ts          the five tool definitions
src/lib/webmcp/register.ts       registration / teardown lifecycle
src/app/components/WebMcpTools.tsx   client component, renders null
src/app/components/PriceExplorer.tsx integration point
src/app/page.tsx                 passes the snapshot timestamp
src/lib/score.ts                 comparator widened so the tools reuse it
tests/webmcp-*.test.ts (5 files) 85 tests
```

## What the WebMCP work does

Five tools registered on `document.modelContext`, so an agent queries the same normalised
data a human reads instead of scraping the DOM:

| Tool | Answers |
| --- | --- |
| `search_ai_model_prices` | "find model X", "which models are under $1 per million input tokens" |
| `compare_ai_model_providers` | "who is cheapest for GPT-5.6 Sol", "show me every provider for X" |
| `estimate_ai_workload_cost` | "what would 50M in and 10M out cost, and where is it cheapest" |
| `compare_ai_models` | "is Claude Opus 5 or GPT-5.6 Sol cheaper, for this workload" |
| `show_ai_prices_in_page` | writes the answer back into the visible page |

See the [Agent tools (WebMCP)](README.md#agent-tools-webmcp) section for the design notes
and the prompts to try.

## Verified live

Tested end to end in the ChatGPT in-app browser against production
(<https://ai-prices.oxweb.xyz>): all five tools discovered and invoked, real pricing data
returned, providers and models compared, workload costs calculated, and the visible page
state changed through `show_ai_prices_in_page`.
