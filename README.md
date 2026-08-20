# AI Price Bot

Live price intelligence for AI models and API gateways.

## Product thesis

AI users increasingly buy the same underlying model through different providers, routers, gateways, resellers and discounted compute marketplaces. The displayed model name may be identical while the effective price differs because of token rates, cache pricing, platform fees, prepaid bonuses, discount multipliers, plans, quotas and temporary promotions.

AI Price Bot should answer one question quickly:

> Where is the cheapest trustworthy place to use this exact AI model right now?

## MVP

1. Web landing + searchable comparison table.
2. Normalize the same model across multiple providers.
3. Show input/output/cache prices and effective discount vs official/reference price.
4. Preserve price history and show recent changes.
5. Telegram bot / alerts for price drops, new models and provider changes.
6. Every price row must expose source, last checked time and confidence/verification state.

## Initial provider classes

- Multi-model marketplaces / routers: OpenRouter, Requesty, MixRoute, PPQ.ai, Kie.ai.
- Discount / surplus marketplaces: Surplus and similar providers discovered during research.
- Direct inference providers where the same open model can have materially different prices: DeepInfra, Together AI, Fireworks AI, Novita AI, Groq and others.
- Direct model vendors are reference-price sources, not necessarily competitors: OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral, Alibaba/Qwen, Zhipu/GLM, Moonshot/Kimi.

## Core rule

Never compare only headline token prices. Compute an `effective_price` from all known price mechanics and keep raw source data so every result is auditable.

## Repo guidance




- `docs/MVP_SPEC.md` — MVP behavior and data model.

No production deployment, paid service signup, secret creation, or destructive migration without explicit approval.