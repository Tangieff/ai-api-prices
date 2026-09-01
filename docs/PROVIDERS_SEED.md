# Initial Provider Seed

> Historical planning record: this seed preserves the original MVP candidates. It is not the
> current active-provider list; see the provider table in `README.md` and the canonical registry in
> `src/lib/providers.ts` for the current curated twelve-provider product.

Use these five providers for MVP launch coverage. This is a product seed, not a completeness claim.

## 1. Surplus Intelligence

- Website: `https://www.surplusintelligence.ai/`
- Docs: `https://www.surplusintelligence.ai/docs`
- Public pricing/reference endpoint documented at: `https://api.surplusintelligence.ai/v1/prices`
- Marketplace/model endpoints are documented publicly; inspect current docs/live responses when implementing.
- Preferred adapter: structured public API.
- Notes: marketplace prices are dynamic. Do not hardcode them if a public endpoint provides current data.

## 2. derouter.ai

- Website: `https://derouter.ai/`
- Pricing: `https://derouter.ai/pricing`
- Preferred adapter: public pricing page parser, or structured source if discovered during implementation.
- Current page publishes model, input/output/cache prices and an official/reference comparison.

## 3. ClawHive

- Website: `https://clawhive.io/`
- Pricing is publicly visible on the site.
- Preferred adapter: public page parser.
- Current public page advertises Claude pricing at 50% below direct pricing and includes input/output values.

## 4. WorldGate

- Website: `https://worldgateapi.com/` (`worldgateapi.fun` redirects here)
- Pricing is publicly visible on the homepage, one table per model family.
- Preferred adapter: public page parser.
- Columns are `Model | Input | Output | Cache R | Cache W | Official I/O | Discount`, and every price cell carries the canonical USD value in a `data-price-usd` attribute. Read the attribute, not the cell text: the page's script rewrites the text into the visitor's billing currency on load, and the server-rendered text can lag the attribute.
- `Official I/O` currently renders as `—` for every model, so rows carry no reference price and show no discount. The same script fills that cell from `data-official-input-usd` / `data-official-output-usd`, so the parser reads those attributes for the day they appear.
- Replaces ClaudeAPI.cheap, which was in the original seed list but publishes no DNS A/AAAA/CNAME record and therefore has no reachable pricing page.

## 5. GetGoAPI

- Website: `https://getgoapi.com/`
- Models/pricing: `https://getgoapi.com/en/models`
- Additional pricing UI: `https://api.getgoapi.com/pricing`
- Preferred adapter: public models page or public structured endpoint if discovered.
- Current public catalog exposes many model-specific input/output prices and some pages include official-vs-service comparisons.

## Adapter priority

For launch, prioritize reliable implementation over theoretical completeness:

1. structured public endpoint;
2. straightforward HTML parser;
3. small manual seed if the public UI cannot be parsed reliably without browser automation.

Do not delay the entire MVP because one provider needs a manual seed.

## Model seed

Start by attempting overlap among popular models exposed by these providers, especially:

- Claude Opus 5 / 4.8 / 4.7 / 4.6 where available;
- Claude Sonnet 5 / 4.6;
- Claude Haiku 4.5;
- GPT-5.6 Sol / Terra / Luna where available;
- GPT-5.5 / GPT-5.4 where available;
- Gemini models where meaningful overlap exists.

Do not require every provider to expose every model.

## Future expansion

After launch, candidates can be imported from larger comparison/catalog sources such as ComputeUnion, GetCheapAI, API-Rank and Chinese relay indexes. This is intentionally post-MVP work.
