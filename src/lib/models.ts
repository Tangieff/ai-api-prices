import type { Model } from './types';

/**
 * Model identity.
 *
 * Every provider names the same model differently:
 *
 *   Surplus Intelligence  claude-opus-4.5
 *   GetGoAPI              claude-opus-4-5-20251101
 *   derouter.ai           Claude Opus 4.5
 *   ClawHive              Claude Opus 4.6
 *
 * `canonicalModelId` folds those into one slug so a search for "opus 4.5"
 * returns every provider that sells it. The rules are intentionally mechanical
 * — no per-provider special cases — and anything unrecognised still gets a
 * usable slug rather than being dropped.
 */

/** Vendor namespaces some catalogues prefix onto the model id. */
const VENDOR_PREFIXES = [
  'aion-labs',
  'alibaba',
  'allenai',
  'amazon',
  'anthracite-org',
  'anthropic',
  'arcee-ai',
  'baidu',
  'bytedance',
  'bytedance-seed',
  'cognitivecomputations',
  'cohere',
  'deepseek',
  'openai',
  'google',
  'x-ai',
  'xai',
  'meta-llama',
  'meta',
  'mistralai',
  'mistral',
  'deepseek-ai',
  'fireworks',
  'gryphe',
  'ibm-granite',
  'inception',
  'inclusionai',
  'kwaipilot',
  'mancer',
  'meituan',
  'microsoft',
  'minimax',
  'moonshot',
  'qwen',
  'moonshotai',
  'morph',
  'nex-agi',
  'nousresearch',
  'nvidia',
  'perceptron',
  'perplexity',
  'poolside',
  'rekaai',
  'relace',
  'sakana',
  'sao10k',
  'stepfun',
  'tencent',
  'thedrummer',
  'thinkingmachines',
  'undi95',
  'upstage',
  'writer',
  'xiaomi',
  'zhipu',
  'z-ai',
  'zai',
  'zai-org',
  // Gateways rename the xAI namespace after its parent company.
  'spacexai',
];

/**
 * Reasoning-effort / thinking suffixes. These are the *same* model sold under a
 * different setting, so they become a tier label on the model rather than a
 * separate model. Keeping them visible matters: providers sometimes price a
 * thinking variant very differently, and silently merging them would show a
 * price the user cannot actually get.
 */
// Order matters: `find` takes the first match, so a negated suffix must precede
// the one it contains — "non-reasoning" before "reasoning", "non-thinking"
// before "thinking". Miss one and the negation is left behind on the slug:
// "glm-5.1-non-thinking" would canonicalise to the model "glm-5.1-non".
const TIER_SUFFIXES = [
  'non-reasoning',
  'non-thinking',
  'nothinking',
  'no-thinking',
  'reasoning',
  'thinking',
  'minimal',
  'medium',
  'high',
  'low',
];

export interface CanonicalModel {
  id: string;
  /** Tier extracted from the raw id, e.g. "thinking". Null for the plain model. */
  tier: string | null;
}

/**
 * Reduce a provider-specific model identifier to a canonical slug plus optional
 * tier.
 *
 * Steps, in order:
 *   1. lowercase, trim, collapse separators (spaces, underscores) to `-`;
 *   2. drop a vendor namespace prefix (`anthropic/claude-opus-5`);
 *   3. preserve release-date snapshots as a tier (`snapshot 2025-11-01`);
 *   4. peel a trailing reasoning-effort suffix into `tier`;
 *   5. rejoin split version numbers (`opus-4-5` -> `opus-4.5`).
 */
export function canonicalModelId(raw: string): CanonicalModel {
  let slug = raw.trim().toLowerCase();

  // A vendor namespace is separated by "/" or ".", e.g. "anthropic/claude-opus-5"
  // or "aion-labs.aion-2-0". Some gateways qualify the vendor with the upstream
  // route they bought it through ("alibaba:zhipu/glm-5.2"); the model is still
  // GLM-5.2, so the whole prefix goes and the adapter keeps the route as a tier.
  const namespaceSplit = /^([a-z0-9-]+)(?::[a-z0-9-]+)?[/.](.+)$/.exec(slug);
  if (namespaceSplit && VENDOR_PREFIXES.includes(namespaceSplit[1]!)) {
    slug = namespaceSplit[2]!;
  }

  slug = slug
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.:-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  let tier: string | null = null;

  // "…-thinking-128": a trailing token budget belongs with the tier suffix in
  // front of it, so hold it aside and only keep it if a suffix really follows.
  let pendingBudget: string | null = null;
  const budget = /^(.*)-(\d{2,5})$/.exec(slug);
  if (budget && TIER_SUFFIXES.some((candidate) => budget[1]!.endsWith(`-${candidate}`))) {
    pendingBudget = budget[2]!;
    slug = budget[1]!;
  }

  // Peel repeatedly so "…-preview-thinking-high" yields the fullest tier label.
  for (;;) {
    const suffix = TIER_SUFFIXES.find((candidate) => slug.endsWith(`-${candidate}`));
    if (!suffix) break;
    tier = tier ? `${suffix}-${tier}` : suffix;
    slug = slug.slice(0, -(suffix.length + 1));
  }
  if (tier && pendingBudget) tier = `${tier}-${pendingBudget}`;

  // Snapshot ids are the same model family but can remain separately
  // selectable and materially differently priced. Keep the date as a tier so
  // deduplication may remove equal-price aliases without silently replacing a
  // distinct old snapshot with the cheapest current alias.
  let snapshot: string | null = null;
  const dashedDate = /-((?:19|20)\d{2})-(\d{2})-(\d{2})$/.exec(slug);
  const compactDate = /-((?:19|20)\d{2})(\d{2})(\d{2})$/.exec(slug);
  const date = dashedDate ?? compactDate;
  if (date) {
    snapshot = `snapshot ${date[1]}-${date[2]}-${date[3]}`;
    slug = slug.slice(0, -date[0].length);
  }
  if (snapshot) tier = tier ? `${snapshot} · ${tier}` : snapshot;

  // Alibaba's official ids use `qwen3.5`, `qwen3.6`, etc. Provider catalogues
  // also publish `qwen-3.6-*` and `qwen3-6-*`; these spellings identify the
  // same documented series, while `qwen3-8b` (Qwen 3, 8B) must stay distinct.
  slug = slug.replace(/^qwen-?3[-.]([5-9])(?=-|$)/, 'qwen3.$1');

  // Version numbers split across separators: "opus-4-5" -> "opus-4.5",
  // "aion-2-0" -> "aion-2.0". Only single-to-double digit groups qualify, so
  // date-like or id-like runs are left alone.
  slug = slug.replace(/(?<=[a-z]-)(\d{1,2})-(\d{1,2})(?=-|$)/g, '$1.$2');

  slug = slug.replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  return { id: slug || raw.trim().toLowerCase(), tier };
}

/**
 * Curated display metadata for the models people actually search for. Anything
 * absent here falls back to `derivedModel`, so this table is a presentation
 * nicety, never a gate on ingestion.
 */
interface KnownModel {
  display_name: string;
  maker: string;
  family: string;
  aliases?: string[];
}

const KNOWN_MODELS: Record<string, KnownModel> = {
  'claude-fable-5': { display_name: 'Claude Fable 5', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-5': { display_name: 'Claude Opus 5', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-5-fast': { display_name: 'Claude Opus 5 Fast', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4.8': { display_name: 'Claude Opus 4.8', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4.8-fast': { display_name: 'Claude Opus 4.8 Fast', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4.7': { display_name: 'Claude Opus 4.7', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4.7-fast': { display_name: 'Claude Opus 4.7 Fast', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4.6': { display_name: 'Claude Opus 4.6', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4.6-fast': { display_name: 'Claude Opus 4.6 Fast', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4.5': { display_name: 'Claude Opus 4.5', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4.1': { display_name: 'Claude Opus 4.1', maker: 'Anthropic', family: 'Claude' },
  'claude-opus-4': { display_name: 'Claude Opus 4', maker: 'Anthropic', family: 'Claude' },
  'claude-sonnet-5': { display_name: 'Claude Sonnet 5', maker: 'Anthropic', family: 'Claude' },
  'claude-sonnet-4.6': { display_name: 'Claude Sonnet 4.6', maker: 'Anthropic', family: 'Claude' },
  'claude-sonnet-4.5': { display_name: 'Claude Sonnet 4.5', maker: 'Anthropic', family: 'Claude' },
  'claude-sonnet-4': { display_name: 'Claude Sonnet 4', maker: 'Anthropic', family: 'Claude' },
  'claude-haiku-4.5': { display_name: 'Claude Haiku 4.5', maker: 'Anthropic', family: 'Claude' },
  'claude-3-haiku': { display_name: 'Claude 3 Haiku', maker: 'Anthropic', family: 'Claude' },

  'gpt-5.6-sol': { display_name: 'GPT-5.6 Sol', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.6-terra': { display_name: 'GPT-5.6 Terra', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.6-luna': { display_name: 'GPT-5.6 Luna', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.6': { display_name: 'GPT-5.6', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.5': { display_name: 'GPT-5.5', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.4': { display_name: 'GPT-5.4', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.4-mini': { display_name: 'GPT-5.4 mini', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.4-nano': { display_name: 'GPT-5.4 nano', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.4-pro': { display_name: 'GPT-5.4 pro', maker: 'OpenAI', family: 'GPT' },
  'gpt-5.2': { display_name: 'GPT-5.2', maker: 'OpenAI', family: 'GPT' },
  'gpt-5': { display_name: 'GPT-5', maker: 'OpenAI', family: 'GPT' },
  'gpt-4o': { display_name: 'GPT-4o', maker: 'OpenAI', family: 'GPT' },
  'gpt-4o-mini': { display_name: 'GPT-4o mini', maker: 'OpenAI', family: 'GPT' },

  'gemini-3.5-flash': { display_name: 'Gemini 3.5 Flash', maker: 'Google', family: 'Gemini' },
  'gemini-3.1-pro': { display_name: 'Gemini 3.1 Pro', maker: 'Google', family: 'Gemini' },
  'gemini-3.1-flash': { display_name: 'Gemini 3.1 Flash', maker: 'Google', family: 'Gemini' },
  'gemini-3-pro': { display_name: 'Gemini 3 Pro', maker: 'Google', family: 'Gemini' },
  'gemini-3-flash': { display_name: 'Gemini 3 Flash', maker: 'Google', family: 'Gemini' },
  'gemini-2.5-pro': { display_name: 'Gemini 2.5 Pro', maker: 'Google', family: 'Gemini' },
  'gemini-2.5-flash': { display_name: 'Gemini 2.5 Flash', maker: 'Google', family: 'Gemini' },
  'gemini-2.0-flash': { display_name: 'Gemini 2.0 Flash', maker: 'Google', family: 'Gemini' },

  'grok-4': { display_name: 'Grok 4', maker: 'xAI', family: 'Grok' },
  'grok-4-fast': { display_name: 'Grok 4 Fast', maker: 'xAI', family: 'Grok' },
  'grok-3': { display_name: 'Grok 3', maker: 'xAI', family: 'Grok' },
  'grok-3-mini': { display_name: 'Grok 3 mini', maker: 'xAI', family: 'Grok' },
  'grok-code-fast-1': { display_name: 'Grok Code Fast 1', maker: 'xAI', family: 'Grok' },

  'deepseek-v4-pro': { display_name: 'DeepSeek V4 Pro', maker: 'DeepSeek', family: 'DeepSeek' },
  'deepseek-v4-flash': { display_name: 'DeepSeek V4 Flash', maker: 'DeepSeek', family: 'DeepSeek' },
  'deepseek-v3.2': { display_name: 'DeepSeek V3.2', maker: 'DeepSeek', family: 'DeepSeek' },
  'deepseek-v3.1': { display_name: 'DeepSeek V3.1', maker: 'DeepSeek', family: 'DeepSeek' },
  'deepseek-r1': { display_name: 'DeepSeek R1', maker: 'DeepSeek', family: 'DeepSeek' },
};

/** Maker inferred from the slug when the model is not in the curated table. */
const MAKER_PATTERNS: [RegExp, string, string][] = [
  [/^claude/, 'Anthropic', 'Claude'],
  [/^gpt|^o[134](-|$)|^chatgpt|^codex/, 'OpenAI', 'GPT'],
  [/^gemini|^gemma/, 'Google', 'Gemini'],
  [/^grok/, 'xAI', 'Grok'],
  [/^deepseek/, 'DeepSeek', 'DeepSeek'],
  [/^qwen/, 'Alibaba', 'Qwen'],
  [/^llama/, 'Meta', 'Llama'],
  [/^mistral|^magistral|^devstral|^codestral/, 'Mistral', 'Mistral'],
  [/^glm/, 'Z.ai', 'GLM'],
  [/^kimi/, 'Moonshot', 'Kimi'],
  [/^minimax/, 'MiniMax', 'MiniMax'],
  [/^nemotron/, 'NVIDIA', 'Nemotron'],
  [/^nova/, 'Amazon', 'Nova'],
  [/^command/, 'Cohere', 'Command'],
  [/^phi/, 'Microsoft', 'Phi'],
  [/^ernie/, 'Baidu', 'ERNIE'],
  [/^olmo/, 'AllenAI', 'OLMo'],
  [/^mimo/, 'Xiaomi', 'MiMo'],
  [/^hunyuan|^hy-/, 'Tencent', 'Hunyuan'],
];

/** Turn a slug into a readable name: "claude-opus-4.5" -> "Claude Opus 4.5". */
function titleiseSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => {
      if (!part) return part;
      // A version token that starts with a letter is still a word to capitalise
      // ("k3" -> "K3", "v4" -> "V4"); one that starts with a digit is not
      // ("4o" must stay "4o", not "4O").
      if (/\d/.test(part) && !/^[a-z]/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ')
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bGlm\b/g, 'GLM')
    .replace(/\bMinimax\b/g, 'MiniMax')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bLlm\b/g, 'LLM')
    .replace(/\bOlmo\b/g, 'OLMo')
    .replace(/\bErnie\b/g, 'ERNIE')
    // OpenAI hyphenates the model number onto the family ("GPT-5.6 Sol",
    // "GPT-4o"), unlike every other vendor. Without this the curated
    // "GPT-5.6 Sol" and the derived "GPT 5.6 Sol Pro" would sit side by side.
    .replace(/^GPT (\d)/, 'GPT-$1');
}

/**
 * Build the `Model` record for a canonical slug, using curated metadata when we
 * have it and deriving something sensible when we do not.
 */
export function describeModel(id: string): Model {
  const known = KNOWN_MODELS[id];
  if (known) {
    return {
      id,
      display_name: known.display_name,
      maker: known.maker,
      family: known.family,
      aliases: [...(known.aliases ?? []), ...autoAliases(id, known.display_name)],
    };
  }

  const pattern = MAKER_PATTERNS.find(([regex]) => regex.test(id));
  const display = titleiseSlug(id);
  return {
    id,
    display_name: display,
    maker: pattern?.[1] ?? null,
    family: pattern?.[2] ?? null,
    aliases: autoAliases(id, display),
  };
}

/**
 * Aliases that make the obvious short queries work: "opus 5", "sonnet",
 * "4.5 haiku". Generated from the slug rather than hand-listed so new models
 * pick it up for free.
 */
function autoAliases(id: string, displayName: string): string[] {
  const aliases = new Set<string>([id, displayName]);
  const parts = id.split('-').filter(Boolean);
  if (parts.length > 1) {
    // Drop the family prefix: "claude-opus-4.5" -> "opus-4.5".
    aliases.add(parts.slice(1).join('-'));
    // Keep just the line name: "claude-opus-4.5" -> "opus".
    if (parts[1]) aliases.add(parts[1]);
  }
  // Dotless and spaced forms: "gpt-5.6-sol" -> "gpt 5.6 sol", "gpt56sol".
  aliases.add(id.replace(/-/g, ' '));
  aliases.add(id.replace(/[-.]/g, ''));
  return [...aliases];
}
