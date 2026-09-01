import { formatUsd } from '../money';
import { COST_SCORE_LABEL } from '../score';
import type { PriceIndex } from './catalog';
import {
  MAX_MODELS_PER_COMPARISON,
  MAX_RESULTS,
  MAX_TEXT_INPUT_LENGTH,
  MAX_TOKENS_PER_FIELD,
  compareModels,
  compareProvidersForModel,
  estimateWorkloadCost,
  resolveModel,
  searchModels,
} from './catalog';
import type { ModelContextTool, ToolExecuteCallbackOptions, ToolResult } from './types';

/**
 * The WebMCP tool surface.
 *
 * Five tools, not one per screen. An agent does not need a tool for every
 * control on the page — it needs the smallest set that answers the questions
 * people actually ask: what exists, what does it cost here versus there, what
 * will my job cost, and can you leave the answer on screen for me.
 *
 * Every description states the unit explicitly. Without that an agent will
 * cheerfully mix per-1M and per-1K figures and confidently report a price that
 * is out by a thousand.
 */

/** Longest search string the UI tool will push into the page's search box. */
export const MAX_SHOW_QUERY_LENGTH = 100;

export interface ShowInPageRequest {
  query: string;
  view: 'models' | 'providers';
}

export interface WebMcpToolContext {
  /**
   * The price index, or a getter for it.
   *
   * The getter form exists because the page refreshes its data every five
   * minutes. Rebuilding the tools on each refresh would unregister and
   * re-register all five, firing `toolchange` at an agent mid-conversation for
   * no reason. Passing a getter keeps the tool objects stable for the lifetime
   * of the mount while each call still reads the newest prices.
   */
  data: PriceIndex | (() => PriceIndex);
  /** Present only where the price explorer is mounted and can actually be driven. */
  showInPage?: (request: ShowInPageRequest) => void;
}

export const WEBMCP_TOOL_NAMES = [
  'search_ai_model_prices',
  'compare_ai_model_providers',
  'estimate_ai_workload_cost',
  'compare_ai_models',
  'show_ai_prices_in_page',
] as const;

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

function ok(text: string, structuredContent: unknown): ToolResult {
  return { content: [{ type: 'text', text }], structuredContent };
}

function fail(error: string, structuredContent?: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: error }],
    structuredContent: structuredContent ?? { error },
    isError: true,
  };
}

function tokens(count: number): string {
  return count.toLocaleString('en-US');
}

function priceLine(input: number | null, output: number | null): string {
  return `${formatUsd(input)} in / ${formatUsd(output)} out per 1M tokens`;
}

/**
 * The as-of stamp that has to travel with every quoted price.
 *
 * These are scraped third-party prices, not a rate card we control. An agent
 * that repeats a dollar figure without saying when it was observed is stating
 * something it cannot actually vouch for.
 */
function asOf(generatedAt: string | null): string {
  return generatedAt ? ` Prices as observed at ${generatedAt}.` : '';
}

/**
 * Wrap an execute body so a tool can never throw into the agent's turn.
 *
 * A thrown error would reject the execute promise, which the user agent reports
 * as a failed tool call with no explanation. Returning a structured error keeps
 * the agent able to correct itself and try again.
 */
function guard(run: (input: Record<string, unknown>) => ToolResult) {
  return async (input: unknown, options?: ToolExecuteCallbackOptions): Promise<ToolResult> => {
    // The work below is synchronous, so honouring the signal up front is the
    // whole of cancellation: nothing is read, and nothing on the page is
    // touched, for a call the agent has already abandoned.
    if (options?.signal?.aborted) {
      return fail('The request was cancelled before the tool ran.');
    }
    try {
      return run(asRecord(input));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(`The tool could not complete this request: ${message}`);
    }
  };
}

export function buildWebMcpTools(context: WebMcpToolContext): ModelContextTool[] {
  const { showInPage } = context;
  const readIndex: () => PriceIndex =
    typeof context.data === 'function' ? context.data : () => context.data as PriceIndex;
  const search: ModelContextTool = {
    name: 'search_ai_model_prices',
    title: 'Search AI model prices',
    description:
      'Search the AI API Prices index for AI models and the discounted per-token prices that inference providers currently publish for them. Filter by model or family name, by the company that makes the model, by a maximum input price, by a maximum output price, and by how many providers sell it. All prices are USD per 1,000,000 tokens. Results are ordered cheapest first using the site ranking (input + 3 x output). Use this to answer "which models cost under $X" or "find model Y".',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          maxLength: MAX_TEXT_INPUT_LENGTH,
          description: 'Model or family name, e.g. "gpt 5.6 sol", "claude opus", "deepseek".',
        },
        maker: {
          type: 'string',
          maxLength: MAX_TEXT_INPUT_LENGTH,
          description: 'Company that makes the model, e.g. "Anthropic", "OpenAI", "Google".',
        },
        max_input_usd_per_1m: {
          type: 'number',
          minimum: 0,
          description: 'Only models with a provider charging at most this much per 1,000,000 input tokens, in USD.',
        },
        max_output_usd_per_1m: {
          type: 'number',
          minimum: 0,
          description: 'Only models with a provider charging at most this much per 1,000,000 output tokens, in USD.',
        },
        min_providers: {
          type: 'integer',
          minimum: 1,
          description: 'Only models sold by at least this many providers.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_RESULTS,
          default: 10,
          description: 'Maximum number of models to return.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: guard((input) => {
      const result = searchModels(readIndex(), input);
      if (result.models.length === 0) {
        return ok('No model in the index matches those filters.', result);
      }
      const lines = result.models.map((model) =>
        model.cheapest
          ? `${model.display_name} — ${priceLine(model.cheapest.input_usd_per_1m, model.cheapest.output_usd_per_1m)} at ${model.cheapest.provider_name} (${model.provider_count} providers)`
          : `${model.display_name} — no comparable price (${model.provider_count} providers)`,
      );
      return ok(
        `${result.returned} of ${result.total_matched} matching models, cheapest first (${COST_SCORE_LABEL}).${asOf(result.generated_at)}\n${lines.join('\n')}`,
        result,
      );
    }),
  };

  const providers: ModelContextTool = {
    name: 'compare_ai_model_providers',
    title: 'Compare providers for one AI model',
    description:
      'List every inference provider selling one specific AI model, ranked cheapest first, with each provider\'s input price, output price, cache prices, saving against the model maker\'s official standard API price, and when the price was last observed. All prices are USD per 1,000,000 tokens. Use this to answer "who is cheapest for model X" or "show me all providers for X". Providers whose last refresh failed are excluded unless include_stale is true, and can never be reported as cheapest.',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          maxLength: MAX_TEXT_INPUT_LENGTH,
          description: 'The model to compare providers for, e.g. "GPT-5.6 Sol" or "claude-opus-5".',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_RESULTS,
          default: 10,
          description: 'Maximum number of providers to return.',
        },
        include_stale: {
          type: 'boolean',
          default: false,
          description: 'Include providers whose most recent price refresh failed. Their prices may be out of date.',
        },
      },
      required: ['model'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: guard((input) => {
      const result = compareProvidersForModel(readIndex(), input);
      if (!result.found) {
        const hint = result.suggestions.length > 0 ? ` Did you mean: ${result.suggestions.join(', ')}?` : '';
        return fail(`${result.reason}${hint}`, result);
      }
      const lines = result.providers.map((provider, index) => {
        const saving = provider.discount_pct === null ? '' : ` · ${provider.discount_pct}% off official`;
        const stale = provider.stale ? ' · stale' : '';
        const tier = provider.tier ? ` [${provider.tier}]` : '';
        return `${index + 1}. ${provider.provider_name}${tier} — ${priceLine(provider.input_usd_per_1m, provider.output_usd_per_1m)}${saving}${stale}`;
      });
      const headline = result.cheapest
        ? `Cheapest: ${result.cheapest.provider_name} at ${priceLine(result.cheapest.input_usd_per_1m, result.cheapest.output_usd_per_1m)}.`
        : 'No provider publishes a comparable input and output price for this model.';
      // `returned` counts rows, and one provider can publish several — a
      // long-context tier alongside its base rate. Counting rows against
      // `provider_count`, which is distinct providers, produced summaries like
      // "11 of 9 providers". Both sides of the ratio are distinct providers
      // now, and the extra rows are named rather than left to look like a
      // miscount.
      const shownProviders = new Set(result.providers.map((provider) => provider.provider_id)).size;
      const extraRows =
        result.returned > shownProviders ? ` (${result.returned} priced routes)` : '';
      return ok(
        `${result.model.display_name} — ${shownProviders} of ${result.provider_count} providers${extraRows}, cheapest first (${COST_SCORE_LABEL}). ${headline}${asOf(result.generated_at)}\n${lines.join('\n')}`,
        result,
      );
    }),
  };

  const workload: ModelContextTool = {
    name: 'estimate_ai_workload_cost',
    title: 'Estimate the USD cost of a token workload',
    description:
      'Calculate what a specific workload actually costs at each provider, given the number of input tokens and output tokens the job will use. Costs are computed from published prices in USD per 1,000,000 tokens and returned as exact USD totals per provider for every requested model, ranked cheapest first, naming the single cheapest model-and-provider combination overall. Pass raw token counts, not millions: 50 million input tokens is 50000000. Use this to answer "which provider is cheapest for this workload" or "what would 50M in and 10M out cost".',
    inputSchema: {
      type: 'object',
      properties: {
        models: {
          type: 'array',
          items: { type: 'string', maxLength: MAX_TEXT_INPUT_LENGTH },
          minItems: 1,
          maxItems: MAX_MODELS_PER_COMPARISON,
          description: 'One to five model names to price, e.g. ["GPT-5.6 Sol", "Claude Opus 5"].',
        },
        input_tokens: {
          type: 'integer',
          minimum: 0,
          maximum: MAX_TOKENS_PER_FIELD,
          description: 'Total whole input (prompt) tokens for the whole workload, as a raw count. Fractional values are rounded.',
        },
        output_tokens: {
          type: 'integer',
          minimum: 0,
          maximum: MAX_TOKENS_PER_FIELD,
          description: 'Total whole output (completion) tokens for the whole workload, as a raw count. Fractional values are rounded.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_RESULTS,
          default: 5,
          description: 'Maximum number of providers to return per model.',
        },
      },
      required: ['models', 'input_tokens', 'output_tokens'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: guard((input) => {
      const result = estimateWorkloadCost(readIndex(), input);
      if (!result.ok) return fail(result.error, result);

      const lines = result.models.map((model) => {
        if (!model.resolved) return `${model.requested} — not found in the index`;
        if (!model.cheapest) return `${model.resolved.display_name} — no provider publishes a costable price`;
        const rest = model.providers
          .slice(1)
          .map((provider) => `${provider.provider_name} ${formatUsd(provider.total_usd)}`)
          .join(', ');
        const tail = rest ? ` (then ${rest})` : '';
        return `${model.resolved.display_name} — ${formatUsd(model.cheapest.total_usd)} at ${model.cheapest.provider_name}${tail}`;
      });

      const headline = result.cheapest_overall
        ? `Cheapest overall: ${result.cheapest_overall.display_name} at ${result.cheapest_overall.provider_name} for ${formatUsd(result.cheapest_overall.total_usd)}.`
        : 'No costable provider price was available for the requested models.';

      return ok(
        `Workload of ${tokens(result.workload.input_tokens)} input and ${tokens(result.workload.output_tokens)} output tokens. ${headline}${asOf(result.generated_at)}\n${lines.join('\n')}`,
        result,
      );
    }),
  };

  const compare: ModelContextTool = {
    name: 'compare_ai_models',
    title: 'Compare two or more AI models',
    description:
      'Compare two to five AI models against each other on published discount-provider pricing: cheapest input price, cheapest output price, how many providers sell each, the best saving against the model maker\'s official price, and which provider is cheapest for each. All prices are USD per 1,000,000 tokens. Optionally pass input_tokens and output_tokens together to also compare the exact USD cost of a specific workload and get the cheapest model-and-provider overall. Use this to answer "is model A or model B cheaper".',
    inputSchema: {
      type: 'object',
      properties: {
        models: {
          type: 'array',
          items: { type: 'string', maxLength: MAX_TEXT_INPUT_LENGTH },
          minItems: 2,
          maxItems: MAX_MODELS_PER_COMPARISON,
          description: 'Two to five model names to compare, e.g. ["Claude Opus 5", "GPT-5.6 Sol"].',
        },
        input_tokens: {
          type: 'integer',
          minimum: 0,
          maximum: MAX_TOKENS_PER_FIELD,
          description: 'Optional. Total input tokens for a workload comparison. Must be given together with output_tokens.',
        },
        output_tokens: {
          type: 'integer',
          minimum: 0,
          maximum: MAX_TOKENS_PER_FIELD,
          description: 'Optional. Total output tokens for a workload comparison. Must be given together with input_tokens.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_RESULTS,
          default: 5,
          description: 'Maximum number of providers considered per model when costing a workload.',
        },
      },
      required: ['models'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: guard((input) => {
      const result = compareModels(readIndex(), input);
      if (!result.ok) return fail(result.error, result);

      const lines = result.models.map((entry) => {
        if (!entry.resolved) return `${entry.requested} — not found in the index`;
        // Quote the winning provider's own prices. The market lows are separate
        // minima that can come from two different providers, so pairing them
        // with one provider's name would describe an offer nobody sells.
        const best = entry.cheapest_provider;
        const priced = best
          ? `${priceLine(best.input_usd_per_1m, best.output_usd_per_1m)} at ${best.provider_name}`
          : 'no comparable price';
        const base = `${entry.resolved.display_name} — ${priced} (${entry.provider_count} providers)`;
        return entry.workload ? `${base} · workload ${formatUsd(entry.workload.total_usd)}` : base;
      });

      const headline = result.cheapest_overall
        ? ` Cheapest for this workload: ${result.cheapest_overall.display_name} at ${result.cheapest_overall.provider_name} for ${formatUsd(result.cheapest_overall.total_usd)}.`
        : '';

      return ok(
        `Comparing ${result.models.length} models on published discount-provider prices (${COST_SCORE_LABEL}).${headline}${asOf(result.generated_at)}\n${lines.join('\n')}`,
        result,
      );
    }),
  };

  const show: ModelContextTool = {
    name: 'show_ai_prices_in_page',
    title: 'Show a result in the page the user is looking at',
    description:
      'Update the AI API Prices page the person is currently viewing so it shows the result the conversation reached: sets the search box and switches between the Models and Providers views. The two views search different things. Models view shows a model\'s price comparison, including every provider selling that model — that is where the answer to "which providers sell X, and which is cheapest" belongs. Providers view is the provider directory and searches provider NAMES only, so a model name typed there matches nothing. Pass model to put that exact model\'s comparison on screen; when it resolves, the tool always opens Models view and ignores any view you asked for, because a model name cannot be found in the provider directory. Pass query on its own for a freer search, and use view: "providers" with it to browse the provider directory by provider name. Call this after answering a pricing question so the human can carry on browsing from that state instead of retyping the query. This only changes the existing on-page search and tab; it does not navigate anywhere.',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          maxLength: MAX_TEXT_INPUT_LENGTH,
          description:
            'A model to put on screen, e.g. "GPT-5.6 Sol". Resolved to its canonical name so the right comparison card is shown. Takes precedence over query.',
        },
        query: {
          type: 'string',
          maxLength: MAX_SHOW_QUERY_LENGTH,
          description: 'Text to put in the page search box, e.g. "gpt 5.6 sol". Pass an empty string to clear it.',
        },
        view: {
          type: 'string',
          enum: ['models', 'providers'],
          default: 'models',
          description:
            'Which of the two existing views to show. "models" lists model price comparisons, including the providers selling a given model — use it for anything about a model, including its cheapest providers. "providers" is the provider directory and matches provider NAMES only, so use it only when browsing for a provider such as "Surplus Intelligence". Ignored when model is supplied and resolves: that always opens the models view.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    // The only tool that changes anything, and all it changes is local view state.
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: guard((input) => {
      const rawQuery = typeof input.query === 'string' ? input.query : '';
      let query = rawQuery.trim().slice(0, MAX_SHOW_QUERY_LENGTH);

      // A named model is resolved to its canonical display name, so the page
      // lands on the exact card the agent was talking about rather than on
      // whatever a loose phrase happens to match.
      const requestedModel = typeof input.model === 'string' ? input.model : '';
      let modelResolved = false;
      if (requestedModel) {
        const resolved = resolveModel(readIndex(), requestedModel);
        if (resolved) {
          query = resolved.display_name.slice(0, MAX_SHOW_QUERY_LENGTH);
          modelResolved = true;
        }
      }

      // The Providers view is a directory: it searches provider *names*. Put a
      // model name into it and the page truthfully reports that no provider is
      // called that — which is what happened in production when an agent
      // answered "cheapest providers for GPT-5.6 Sol" and then asked for the
      // providers view. A resolved model therefore always lands on the Models
      // view, where that model's providers are what is listed. A query with no
      // resolved model still honours whichever view the agent asked for, so
      // browsing the provider directory keeps working.
      const requestedView = input.view === 'providers' ? 'providers' : 'models';
      const view = modelResolved ? 'models' : requestedView;

      if (!showInPage) {
        return ok('This page cannot be updated from here; the price explorer is not on screen.', {
          applied: false,
          reason: 'No price explorer is mounted on this page.',
          query,
          view,
        });
      }

      showInPage({ query, view });
      const what = query ? `filtered by "${query}"` : 'with the search cleared';
      return ok(`Updated the page: showing the ${view} view ${what}.`, { applied: true, query, view });
    }),
  };

  return [search, providers, workload, compare, show];
}
