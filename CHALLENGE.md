# OpenAI WebMCP Challenge — what is new here

AI API Prices existed before the challenge. This file separates the prior work from the
work added during the Submission Period, because the rules evaluate a pre-existing project
only on what was added after the start.

**Submission Period opened:** 2026-08-25, 11:00 PT — `2026-08-25T18:00:00Z`.

This repository's commit history is the evidence, and it is genuine: author and commit
dates are the original ones. Verify the boundary yourself with:

```bash
git log --date=iso-strict --pretty='%h %ad %s' --since=2026-08-25T18:00:00Z
```

## Prior work — before the Submission Period

The price-comparison product: 18 provider adapters, canonical model and price
normalisation, the ranking rule, official-price baselines, the homepage, the model pages,
the JSON feed, and the deployment.

The last commit before the Submission Period opened is

at or before it is prior work and is not offered as challenge work.

## Challenge work — during the Submission Period

**The submitted feature is the WebMCP agent-tool surface**, added in
`feat: expose the price index to AI agents over WebMCP`, dated **2026-08-26T13:48:30Z** and
merged the same day — about 20 hours after the period opened.

That change is 13 files, +2431/−2 lines:

```
src/lib/webmcp/types.ts              WebMCP typings + feature detection
src/lib/webmcp/catalog.ts            pure query and costing layer
src/lib/webmcp/tools.ts              the five tool definitions
src/lib/webmcp/register.ts           registration / teardown lifecycle
src/app/components/WebMcpTools.tsx   client component, renders null
src/app/components/PriceExplorer.tsx integration point
src/app/page.tsx                     passes the snapshot timestamp
src/lib/score.ts                     comparator widened so the tools reuse it
tests/webmcp-*.test.ts (5 files)     85 tests
```

Two other things also happened during the period and are **not** part of the submitted
feature: the rename to *AI API Prices* with its hostname cutover, and the open-source
release work (this file, the licence, third-party notices, and documentation tidying).
They are listed here so the feature diff above is not read as covering them.

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

Design notes and prompts to try: [Agent tools (WebMCP)](README.md#agent-tools-webmcp).

## Live

<https://ai-prices.oxweb.xyz>

The maintainer has tested all five tools end to end in the ChatGPT in-app browser against
production: discovered, invoked, real pricing returned, providers and models compared,
workload costs calculated, and page state changed via `show_ai_prices_in_page`. The
submission's demo video is the record of that run — this file is not evidence of it.
