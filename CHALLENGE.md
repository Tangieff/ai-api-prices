# OpenAI WebMCP Challenge — what is new here

AI API Prices existed before the challenge. This file separates the prior work from the
work added during the Submission Period, because the rules evaluate a pre-existing project
only on what was added after the start.

**Submission Period opened:** 2026-08-25, 11:00 PT — `2026-08-25T18:00:00Z`.

This repository's commit history is the evidence. Verify the boundary yourself:

```bash
git log --date=iso-strict --pretty='%h %ad %s' --since=2026-08-25T18:00:00Z
```

### About this history

This is a **sanitized filtered copy** of a private working repository. The development is
real and so are the dates; what was removed was operational material that has no place in a
public repository. Commits containing no public product material were omitted.

- **Author and commit dates are the originals.** Nothing is backdated or invented.
- **Commit order and evidence-bearing subjects are preserved.** Sensitive message bodies are omitted.
- **Commit hashes differ from the private repository**, because filtering rewrites them.
  Nothing here cites a hash from the private repository as evidence; the boundary is
  identified by commit subject and UTC date, which survive filtering and are what the
  command above prints.
- **Commits that contained only non-public material are gone**, so the history is shorter
  than the private one.
- **Author and committer email is normalised** to the maintainer's GitHub noreply address.

## Prior work — before the Submission Period

The price-comparison product: 18 provider adapters, canonical model and price
normalisation, the ranking rule, official-price baselines, the homepage, the model pages,
the JSON feed, and the deployment.

The last commit before the Submission Period opened that survives in this history is
`Merge pull request #31 from Tangieff/audit/comprehensive-pricing-2026-08-24`, dated
**2026-08-24T17:26:14Z**. Everything at or before it is prior work and is not offered as
challenge work.

An additional pre-period commit contained no public product material and was omitted. No product code changed in the resulting gap.


## Challenge work — during the Submission Period

**The submitted feature is the WebMCP agent-tool surface**, added in
`feat: expose the price index to AI agents over WebMCP`, dated **2026-08-26T13:48:30Z** and
merged the same day — about 20 hours after the period opened.

That change is 14 files, +2475/−2 lines — check it with `git show --stat` on that commit:

```
src/lib/webmcp/types.ts              WebMCP typings + feature detection
src/lib/webmcp/catalog.ts            pure query and costing layer
src/lib/webmcp/tools.ts              the five tool definitions
src/lib/webmcp/register.ts           registration / teardown lifecycle
src/app/components/WebMcpTools.tsx   client component, renders null
src/app/components/PriceExplorer.tsx integration point
src/app/page.tsx                     passes the snapshot timestamp
src/lib/score.ts                     comparator widened so the tools reuse it
tests/webmcp-fixture.ts              shared test catalogue
tests/webmcp-*.test.ts (4 files)     85 tests
README.md                            the Agent tools section
```

Two other things also happened during the period and are **not** part of the submitted
feature: the rename to *AI API Prices* with its hostname cutover, and the open-source
release work (this file, the licence, third-party notices, and documentation tidying).
They are listed here so the feature diff above is not read as covering them.

## Subsequent challenge-period product hardening

After the WebMCP tool surface above was built, later product-hardening changes clarified the
homepage copy so agent use is explicit, curated the active refresh registry to six public-source
providers, and required homepage-featured models to have usable live input/output pricing plus a
comparable saving against an official model-maker baseline. The broader catalogue remains
searchable by people and by the existing WebMCP tools.

These are later product changes. They do not change when the WebMCP feature was implemented, the
historical boundary above, or the size and contents of the original WebMCP commit.

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

## Try it — live

**<https://ai-prices.oxweb.xyz>**

Open that URL in **ChatGPT's in-app browser**, which supports WebMCP out of the box, or in
Chrome/Edge with the WebMCP origin trial enabled. The page registers its five tools on load;
no sign-in, no key, nothing to configure.

Then ask, in order — this is the whole loop in three turns:

1. **"Find GPT-5.6 Sol and show me its cheapest providers."**
   → `search_ai_model_prices`, then `compare_ai_model_providers`. Returns a ranked provider
   table with savings against OpenAI's own published price, and the timestamp the prices
   were observed.
2. **"Compare Claude Opus 5 and GPT-5.6 Sol for 50 million input and 10 million output
   tokens."**
   → `compare_ai_models` with the workload. Exact USD totals, computed in integer micro-USD
   from live scraped prices, with the cheaper model and provider named.
3. **"Put GPT-5.6 Sol on the page so I can keep browsing."**
   → `show_ai_prices_in_page`. The page underneath the conversation changes to that
   comparison, so the human carries on from where the agent got to.

Two more worth trying:

- "Which provider is cheapest for that workload, and how far below the official price?"
- "Show me Anthropic models where some provider charges under $1 per million input tokens."

A plain browser with no WebMCP support gets the ordinary site, unchanged — the integration
is feature-detected and adds no markup.

The maintainer has run all five tools end to end in the ChatGPT in-app browser against
production. The submission's demo video is the record of that run; this file is not
evidence of it.

---

## Challenge-period hardening — September 2026

Work done inside the Submission Period, after the sections above. The commit history is
the evidence; this section only summarises it.

**The active provider set grew from six to twelve.** Six gateways were added — ZenMux,
GPTProto, EvoLink, OhMyGPT, QuickSilver Pro and TeamoRouter. Each was admitted on the same
two questions: is there a public, retrievable customer price, and can the service be
publicly attributed to a named person or a registered company. Two further gateways were
implemented and tested but are **not** active, so their adapters sit in the tree as history
without contributing a row.

**What that changed for the comparison tables.** Every one of the six flagship models
— Claude Fable 5, Claude Opus 5, Claude Sonnet 5, GPT-5.6 Sol, Gemini 3.1 Pro Preview and
Grok 4.6 — now carries more providers than before, between seven and ten each, and each is
compared against an independently maintained first-party baseline.

**Normalisation was hardened, twice, because real catalogues broke it.** Gateways rename
model namespaces, and an unrecognised namespace was being glued onto the model id rather
than stripped, producing a model with no official baseline and therefore no savings figure.
Separately, one gateway labels every model "Vendor: Model", and the pipeline canonicalises
that label ahead of the id, folding it to a similarly broken id. Both are fixed and both
have regression tests.

**Provider-stated prices are never trusted.** Several of these catalogues publish a
struck-through "list" price, a "% off" badge, or a claimed official rate — and some of
those claims are simply wrong, including one whose advertised discount is larger than the
maker's real price gap and another whose "discounted" output rate is above the official
one. None of it is ingested. Savings are computed only against `src/lib/official-prices.ts`.

**Prices are read live, not pinned.** Where a provider's rate is a time-limited promotion
it is ingested as published and corrects itself on the next refresh. Where a route is
priced in a currency with no published conversion, it is excluded rather than converted at
an invented rate.

**A provider transparency layer** records what the public record establishes about who
operates each provider — a named operator, a registered company, or neither. It is
deliberately not a safety, quality or authenticity rating, and it does not verify that a
provider serves the model it advertises. `docs/PROVIDER_VERIFICATION.md` states those
limits in full.

### What this product still is not

It compares published prices. It does not buy, route or resell inference, does not process
payments, does not verify model authenticity, and does not rate providers as trustworthy.
Outbound links to some providers carry a referral code; that affects navigation only and
never ranking, ingestion, savings or the WebMCP tool results.
