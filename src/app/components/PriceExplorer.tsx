'use client';

import { useDeferredValue, useId, useMemo, useState } from 'react';
import { pickFeaturedModels } from '@/lib/featured-models';
import { matches } from '@/lib/search';
import type { ModelView, ProviderRef } from '@/lib/view';
import { ModelCard } from './ModelCard';
import { pluralise } from './format';
import { useClock } from './useClock';

/**
 * Search and results.
 *
 * The whole catalogue arrives from the server already sorted and with a
 * precomputed search blob per model, so this component only filters an array —
 * no fetching, no state library, no debounce beyond React's own deferred value.
 *
 * The homepage is intentionally curated: without a query it shows only the
 * current priority models. The full provider catalogue stays searchable.
 */

const SEARCH_VISIBLE = 60;

const EXAMPLE_QUERIES = ['fable 5', 'gpt 5.6 sol', 'opus 5', 'sonnet 5', 'glm 5.2', 'grok 4.6'];

interface PriceExplorerProps {
  models: ModelView[];
  providers: Record<string, ProviderRef>;
  totalOffers: number;
  providerCount: number;
  providersWithPrices: number;
}

export function PriceExplorer({
  models,
  providers,
  totalOffers,
  providerCount,
  providersWithPrices,
}: PriceExplorerProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const inputId = useId();

  // Null until mounted, so the server and client render the same markup; see
  // `useClock`. Offer rows fall back to an absolute date until it arrives.
  const now = useClock();
  const featured = useMemo(() => pickFeaturedModels(models), [models]);

  const filtered = useMemo(() => {
    const trimmed = deferredQuery.trim();
    if (!trimmed) return featured;
    return models.filter((model) => matches(model.search_text, trimmed));
  }, [models, featured, deferredQuery]);

  const searching = deferredQuery.trim().length > 0;
  const visible = searching ? filtered.slice(0, SEARCH_VISIBLE) : filtered;
  const hidden = searching ? filtered.length - visible.length : 0;

  return (
    <>
      <div className="hero">
        <div className="shell">
          <p className="eyebrow">AI inference price index</p>
          <h1>Compare AI model prices</h1>
          <p className="hero__lead">
            Published prices from discount inference providers, normalised to US dollars per million
            tokens.
          </p>

          <div className="search">
            <label className="visually-hidden" htmlFor={inputId}>
              Search for an AI model
            </label>
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Claude, GPT, Gemini, DeepSeek…"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {query ? (
              <button
                type="button"
                className="search__clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          {/* The dataset's vital signs, sized as metadata under the control they
              describe rather than promoted into a separate stat band. */}
          <p className="readout">
            <b>{models.length}</b> models searchable
            <span className="readout__sep">·</span>
            <b>{totalOffers}</b> published prices
            <span className="readout__sep">·</span>
            <b>
              {providersWithPrices}/{providerCount}
            </b>{' '}
            providers reporting
          </p>

          <p className="hint">
            Try{' '}
            {EXAMPLE_QUERIES.map((example, index) => (
              <span key={example}>
                {index > 0 ? ', ' : ''}
                <button type="button" onClick={() => setQuery(example)}>
                  {example}
                </button>
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="results">
        <div className="shell">
          <p className="results__meta" role="status">
            {searching
              ? `${pluralise(filtered.length, 'model')} matching “${deferredQuery.trim()}”`
              : `${pluralise(visible.length, 'featured model')} · search all ${pluralise(models.length, 'model')}`}
          </p>

          {visible.length === 0 ? (
            <div className="empty">
              <h2>No model matches “{deferredQuery.trim()}”</h2>
              <p>
                Coverage is limited to five providers for now, so not every model is listed. Try a
                shorter query such as “opus” or “gpt”.
              </p>
              <button type="button" className="button-quiet" onClick={() => setQuery('')}>
                Back to featured models
              </button>
            </div>
          ) : (
            <div className="index">
              {visible.map((model) => (
                <ModelCard key={model.id} model={model} providers={providers} now={now} />
              ))}
            </div>
          )}

          {hidden > 0 ? (
            <p className="results__meta">
              {hidden} more {hidden === 1 ? 'match is' : 'matches are'} hidden — narrow the search to
              see them.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
