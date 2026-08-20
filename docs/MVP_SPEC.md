# MVP Spec — OXWeb Prices

## One-sentence product

A fast public comparison page showing where popular AI models are currently offered and at what published price across discount inference providers.

## Launch scope

The MVP is deliberately small. It should be publishable with five providers and a useful set of models rather than waiting for broad market coverage.

## Page structure

### Header
- OXWeb Prices wordmark
- small link back to OXWeb placeholder/configurable URL

### Intro
- concise title focused on saving money on AI inference
- one-sentence explanation
- search field

### Comparison
Primary interface.

Desktop columns:
- Model
- Provider
- Input / 1M
- Output / 1M
- Discount when meaningful
- Updated
- action (`Visit`)

Mobile may use compact cards/stacked rows rather than forcing a wide table.

### Empty/error states
- no search matches: clear reset/search message
- one provider failed refresh: do not show a global fatal error if other data exists
- no cached data at all: show a simple unavailable state rather than crashing

## Search

Search should match common names and reasonable aliases, for example:

- `opus 5`
- `claude opus`
- `sonnet`
- `gpt 5.6`
- `gpt-5.6-sol`

Do not create a large fuzzy-search service. Small client-side normalization is enough.

## Sorting

Within a model, show cheapest offers first using one deterministic cost score. Default recommendation: `input + 3 * output` when both are available. Missing values sort after complete comparable offers.

## Provider link behavior

Each provider record has:

- `website_url`
- optional `affiliate_url`

Button destination = `affiliate_url ?? website_url`.

This is the only referral-related behavior required in MVP.

## Price ingestion

Each provider has a small independent adapter.

Adapter output should contain normalized offers plus source URL and observed timestamp.

Adapters may be one of:

- public JSON/API fetch;
- public HTML parser;
- manual/seeded data for v1.

Manual seed is acceptable when automation would delay launch. The code must make the source type obvious so it can be automated later.

Refresh should collect adapters independently and keep successful results even when another adapter fails.

## Reference price / discount

Discount is an optional display field, not a prerequisite for an offer.

If a source clearly provides a meaningful reference/list price, calculate the percentage consistently.

If a model has no sensible single reference price, display only the actual provider prices.

## Visual direction

- neutral/dark or light information-first palette;
- one restrained accent color that is not acid green;
- typography and spacing should carry the design;
- price should visually dominate each row;
- no decorative AI imagery required;
- no generic glowing green SaaS treatment.

## Performance

This is a small catalog. Prefer server rendering/static-friendly rendering and minimal client JavaScript.

## Accessibility/basic SEO

- semantic headings and table/row labels;
- keyboard-accessible search/actions;
- reasonable title/description metadata;
- OpenGraph metadata can be basic text only for v1.

## Not required before launch

Everything explicitly listed as a non-goal remains out of scope.
