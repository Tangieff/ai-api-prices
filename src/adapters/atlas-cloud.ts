import { fetchJson } from '@/lib/http';
import type { Adapter, RawOffer } from './types';
import { isComparableTextTokenModel } from './text-model';

/**
 * Atlas Cloud — GET /v1/models.
 *
 * The envelope is `{ code, msg, data: [...] }`, not a bare array — a plain
 * `Array.isArray(payload)` check would silently accept a differently-shaped
 * response, so the envelope fields are validated explicitly and the adapter
 * fails closed the moment any of them stop looking like success.
 *
 * Every price in `pricing` is a decimal USD-per-token string (e.g.
 * `"0.000005"`). Converting those to USD-per-1M via `Number(str) * 1_000_000`
 * hits ordinary binary-float error (`0.0000002 * 1e6 === 0.19999999999999998`,
 * `0.00000396 * 1e6 === 3.9600000000000004`), which is exactly the kind of
 * floating-point financial transform this codebase avoids. `perTokenToPer1m`
 * instead shifts the decimal point through the digit string with BigInt
 * arithmetic and only calls `Number()` on the final exact decimal string, the
 * same way a human typing "3.96" would.
 */

const MODELS_URL = 'https://api.atlascloud.ai/v1/models';

/** The quantization every mainstream route on this platform ships at. Anything
 * looser (e.g. "fp4") or tighter is a materially different product and gets
 * tagged with `tier` so it is never compared like-for-like against a full-fp8
 * route of "the same" model — see `deepseek-ai/deepseek-v4-pro` (fp4) vs.
 * `deepseek-ai/deepseek-v4-pro-0813` (fp8), which differ in both fields. */
const BASELINE_QUANTIZATION = 'fp8';

/**
 * `-aws` suffixed ids (e.g. `anthropic/claude-opus-5-aws`) are the identical
 * model on AWS-hosted infrastructure: same price, same quantization, same
 * name plus " AWS", confirmed across every Claude id that has one. That is a
 * routing/hosting distinction, not a distinct commercial offer, so these are
 * treated as duplicates of the base id and dropped rather than given their
 * own row.
 */
const HOSTING_DUPLICATE_SUFFIX = /-aws$/i;

interface Pricing {
  prompt?: unknown;
  completion?: unknown;
  input_cache_read?: unknown;
}

interface ModelRow {
  id?: unknown;
  name?: unknown;
  output_modalities?: unknown;
  quantization?: unknown;
  pricing?: unknown;
}

interface ModelsEnvelope {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
}

/** Exact decimal-string USD-per-token -> USD-per-1M, with no float multiplication. */
function perTokenToPer1m(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const [intPartRaw, fracPartRaw = ''] = raw.split('.') as [string, string | undefined];
  const digits = (intPartRaw + fracPartRaw).replace(/^0+(?=\d)/, '') || '0';
  const numerator = BigInt(digits);
  if (numerator === 0n) return null;

  const fracLen = fracPartRaw.length;
  const shift = fracLen - 6; // decimal places remaining once multiplied by 1_000_000
  const resultStr =
    shift <= 0
      ? (numerator * 10n ** BigInt(-shift)).toString()
      : (() => {
          const s = numerator.toString().padStart(shift + 1, '0');
          const cut = s.length - shift;
          return `${s.slice(0, cut)}.${s.slice(cut)}`;
        })();

  const value = Number(resultStr);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isTextOnlyOutput(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((m) => m === 'text');
}

export function parseModels(payload: unknown): RawOffer[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Atlas Cloud: models response is not an object');
  }
  const envelope = payload as ModelsEnvelope;
  if (envelope.code !== 200 || typeof envelope.msg !== 'string' || !Array.isArray(envelope.data)) {
    throw new Error('Atlas Cloud: unexpected models envelope shape');
  }

  const offers: RawOffer[] = [];
  for (const row of envelope.data as ModelRow[]) {
    if (!row || typeof row.id !== 'string' || row.id === '') continue;
    if (!isComparableTextTokenModel(row.id)) continue;
    if (!isTextOnlyOutput(row.output_modalities)) continue;
    if (HOSTING_DUPLICATE_SUFFIX.test(row.id)) continue;

    const pricing = row.pricing as Pricing | null | undefined;
    if (!pricing || typeof pricing !== 'object') continue;

    const input = perTokenToPer1m(pricing.prompt);
    const output = perTokenToPer1m(pricing.completion);
    if (input === null || output === null) continue;

    const quantization = typeof row.quantization === 'string' ? row.quantization.trim() : '';
    const tier =
      quantization !== '' && quantization.toLowerCase() !== BASELINE_QUANTIZATION ? quantization : null;

    offers.push({
      provider_model_id: row.id,
      display_name: typeof row.name === 'string' && row.name !== '' ? row.name : undefined,
      input_usd_per_1m: input,
      output_usd_per_1m: output,
      cache_read_usd_per_1m: perTokenToPer1m(pricing.input_cache_read),
      tier,
      source_url: MODELS_URL,
    });
  }

  if (offers.length === 0) {
    throw new Error('Atlas Cloud: no comparable text-token models found');
  }
  return offers;
}

export const atlasCloudAdapter: Adapter = {
  provider_id: 'atlas-cloud',
  source_kind: 'api',
  async fetchOffers() {
    return parseModels(await fetchJson<unknown>(MODELS_URL));
  },
};
