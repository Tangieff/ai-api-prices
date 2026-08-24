import type { Offer } from './types';

export interface OfficialPriceBaseline {
  model_id: string;
  input_usd_per_1m: number;
  output_usd_per_1m: number;
  source_url: string;
  verified_at: string;
  /** Inclusive UTC calendar date after which the baseline must be re-verified. */
  valid_through?: string;
  note: string;
}

export interface OfficialPriceComparison {
  baseline: OfficialPriceBaseline | null;
  comparable: boolean;
  unavailable_reason: string | null;
}

const VERIFIED_AT = '2026-08-24';
const OPENAI_SOURCE = 'https://developers.openai.com/api/docs/models/compare';
const OPENAI_SOL_SOURCE = 'https://developers.openai.com/api/docs/models/gpt-5.6-sol';
const ANTHROPIC_OPUS_SOURCE = 'https://www.anthropic.com/claude/opus';
const ANTHROPIC_SONNET_SOURCE = 'https://www.anthropic.com/news/claude-sonnet-5';
const ANTHROPIC_FABLE_SOURCE = 'https://www.anthropic.com/claude/fable';
const ANTHROPIC_CATALOGUE_SOURCE =
  'https://www-cdn.anthropic.com/files/4zrzovbb/website/5678bc2f5978e5bcd4f1fe7c14b2c72284dcf9f8.pdf';
const GOOGLE_SOURCE = 'https://ai.google.dev/gemini-api/docs/pricing';
const XAI_SOURCE = 'https://docs.x.ai/developers/pricing';
const DEEPSEEK_SOURCE = 'https://api-docs.deepseek.com/quick_start/pricing';
const ZAI_SOURCE = 'https://docs.z.ai/guides/overview/pricing';

function baseline(
  model_id: string,
  input_usd_per_1m: number,
  output_usd_per_1m: number,
  source_url: string,
  note: string,
  valid_through?: string,
): OfficialPriceBaseline {
  return {
    model_id,
    input_usd_per_1m,
    output_usd_per_1m,
    source_url,
    verified_at: VERIFIED_AT,
    ...(valid_through ? { valid_through } : {}),
    note,
  };
}

const records: OfficialPriceBaseline[] = [
  baseline(
    'gpt-5.6',
    4,
    20,
    OPENAI_SOL_SOURCE,
    'Promotional standard API pricing available at least through 2026-11-21; prompts over 272K use higher rates.',
    '2026-11-21',
  ),
  baseline(
    'gpt-5.6-sol',
    4,
    20,
    OPENAI_SOL_SOURCE,
    'Promotional standard API pricing available at least through 2026-11-21; prompts over 272K use higher rates.',
    '2026-11-21',
  ),
  baseline('gpt-5.6-terra', 2, 12, OPENAI_SOURCE, 'Standard API pricing; prompts over 272K use higher rates.'),
  baseline('gpt-5.6-luna', 0.2, 1.2, OPENAI_SOURCE, 'Standard API pricing; prompts over 272K use higher rates.'),

  baseline('claude-fable-5', 10, 50, ANTHROPIC_FABLE_SOURCE, 'Global standard Claude API pricing; US-only inference is 1.1x.'),
  baseline('claude-opus-5', 5, 25, ANTHROPIC_OPUS_SOURCE, 'Global standard Claude API pricing; US-only inference is 1.1x.'),
  baseline('claude-opus-5-fast', 10, 50, ANTHROPIC_OPUS_SOURCE, 'Claude API Fast mode is twice the standard Opus 5 token price.'),
  baseline(
    'claude-sonnet-5',
    2,
    10,
    ANTHROPIC_SONNET_SOURCE,
    'Introductory global standard price through 2026-08-31; then $3 input / $15 output.',
    '2026-08-31',
  ),
  baseline('claude-opus-4.8', 5, 25, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing.'),
  baseline('claude-opus-4.7', 5, 25, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing.'),
  baseline('claude-opus-4.6', 5, 25, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing.'),
  baseline('claude-opus-4.5', 5, 25, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing up to 200K context.'),
  baseline('claude-opus-4.1', 15, 75, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing up to 200K context.'),
  baseline('claude-opus-4', 15, 75, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing up to 200K context.'),
  baseline('claude-sonnet-4.6', 3, 15, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing.'),
  baseline('claude-sonnet-4.5', 3, 15, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing up to 200K context.'),
  baseline('claude-sonnet-4', 3, 15, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing up to 200K context.'),
  baseline('claude-haiku-4.5', 1, 5, ANTHROPIC_CATALOGUE_SOURCE, 'Global standard Claude API pricing up to 200K context.'),

  baseline('gemini-3.1-pro', 2, 12, GOOGLE_SOURCE, 'Gemini Developer API standard pricing for prompts up to 200K tokens.'),
  baseline('gemini-3.1-pro-preview', 2, 12, GOOGLE_SOURCE, 'Gemini Developer API standard pricing for prompts up to 200K tokens; preview model.'),
  baseline('gemini-3.1-pro-preview-customtools', 2, 12, GOOGLE_SOURCE, 'Gemini Developer API standard custom-tools pricing for prompts up to 200K tokens; preview model.'),
  baseline('gemini-3-flash', 0.5, 3, GOOGLE_SOURCE, 'Gemini Developer API standard text pricing.'),
  baseline('gemini-3-flash-preview', 0.5, 3, GOOGLE_SOURCE, 'Gemini Developer API standard text pricing; preview model.'),
  baseline('gemini-3.1-flash-lite', 0.25, 1.5, GOOGLE_SOURCE, 'Gemini Developer API standard text pricing.'),
  baseline('gemini-3.1-flash-lite-preview', 0.25, 1.5, GOOGLE_SOURCE, 'Gemini Developer API standard text pricing; preview model.'),
  baseline('gemini-3.5-flash-lite', 0.3, 2.5, GOOGLE_SOURCE, 'Gemini Developer API standard text pricing.'),

  baseline('grok-4.6', 2, 6, XAI_SOURCE, 'Standard short-context pricing below 200K prompt tokens.'),
  baseline('grok-4.5', 2, 6, XAI_SOURCE, 'Standard short-context pricing below 200K prompt tokens.'),
  baseline('grok-4.3', 1.25, 2.5, XAI_SOURCE, 'Standard short-context pricing below 200K prompt tokens.'),

  baseline('deepseek-v4-pro', 0.435, 0.87, DEEPSEEK_SOURCE, 'Standard cache-miss input and output pricing; cache hits cost less.'),
  baseline('deepseek-v4-flash', 0.14, 0.28, DEEPSEEK_SOURCE, 'Standard cache-miss input and output pricing; cache hits cost less.'),

  baseline('glm-5.3', 1.4, 4.4, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-5.2', 1.4, 4.4, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-5.1', 1.4, 4.4, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-5', 1, 3.2, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-5-turbo', 1.2, 4, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-4.7', 0.6, 2.2, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-4.6', 0.6, 2.2, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-4.5', 0.6, 2.2, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-4.5-air', 0.2, 1.1, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go text pricing.'),
  baseline('glm-5v-turbo', 1.2, 4, ZAI_SOURCE, 'Standard Z.ai pay-as-you-go token pricing for the vision-language model.'),
];

export const OFFICIAL_PRICE_BASELINES: ReadonlyMap<string, OfficialPriceBaseline> = new Map(
  records.map((record) => [record.model_id, record]),
);

const INCOMPATIBLE_TIER =
  /\bbatch\b|\bpriority\b|\bfast(?: mode)?\b|long[_ -]?context|(?:>|≥)\s*\d+\s*k|\b(?:128|200|256|272|512)\s*k\s*[-–]/i;

/**
 * Resolve the official standard API baseline for a public offer.
 *
 * Provider route and plan labels normally remain comparable: they explain how
 * the relay arrives at its price, but the economic reference is still the same
 * maker API model. Official batch/priority/fast and long-context variants are
 * deliberately excluded unless OXP represents them as their own canonical
 * model with a matching baseline.
 */
export function officialPriceComparison(
  offer: Pick<Offer, 'model_id' | 'tier'>,
  now: Date = new Date(),
): OfficialPriceComparison {
  const baseline = OFFICIAL_PRICE_BASELINES.get(offer.model_id) ?? null;
  if (!baseline) {
    return {
      baseline: null,
      comparable: false,
      unavailable_reason: 'Official comparable baseline unavailable',
    };
  }

  if (baseline.valid_through) {
    const validThroughEnd = Date.parse(`${baseline.valid_through}T23:59:59.999Z`);
    if (
      Number.isNaN(validThroughEnd) ||
      Number.isNaN(now.getTime()) ||
      now.getTime() > validThroughEnd
    ) {
      return {
        baseline,
        comparable: false,
        unavailable_reason: 'Official baseline requires re-verification',
      };
    }
  }

  if (offer.tier && INCOMPATIBLE_TIER.test(offer.tier)) {
    return {
      baseline,
      comparable: false,
      unavailable_reason: 'Official comparable baseline unavailable for this tier',
    };
  }

  return { baseline, comparable: true, unavailable_reason: null };
}
