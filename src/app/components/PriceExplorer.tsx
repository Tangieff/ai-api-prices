'use client';

import { useCallback, useDeferredValue, useId, useMemo, useState } from 'react';
import { pickFeaturedModels } from '@/lib/featured-models';
import { buildProviderSummaries } from '@/lib/provider-summaries';
import { matches } from '@/lib/search';
import type { PriceIndex } from '@/lib/webmcp/catalog';
import type { ShowInPageRequest } from '@/lib/webmcp/tools';
import type { ModelView, ProviderRef } from '@/lib/view';
import { ModelCard } from './ModelCard';
import { WebMcpTools } from './WebMcpTools';
import { pluralise, updatedLabel, utcStamp } from './format';
import { useClock } from './useClock';
import styles from './discovery.module.css';

const SEARCH_VISIBLE = 60;

const EXAMPLE_QUERIES = [
  'fable 5',
  'gpt 5.6 sol',
  'gemini 3.1 pro',
  'deepseek v4 pro',
  'glm 5.3',
  'grok 4.6',
];

/**
 * Fast intent shortcuts, not compatibility claims. They narrow the price index
 * to model families commonly used with each coding client; each relay's actual
 * client support still needs to be checked before signup.
 */
const CODING_SHORTCUTS = [
  { label: 'Claude Code', query: 'claude' },
  { label: 'Codex', query: 'gpt 5.6 sol' },
  { label: 'Gemini CLI', query: 'gemini' },
] as const;

interface PriceExplorerProps {
  models: ModelView[];
  providers: Record<string, ProviderRef>;
  totalOffers: number;
  providerCount: number;
  providersWithPrices: number;
  /** UTC instant of the price snapshot, reported by the WebMCP tools with every quote. */
  generatedAt: string | null;
}

export function PriceExplorer({
  models,
  providers,
  totalOffers,
  providerCount,
  providersWithPrices,
  generatedAt,
}: PriceExplorerProps) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'models' | 'providers'>('models');
  const deferredQuery = useDeferredValue(query);
  const inputId = useId();

  const now = useClock();
  const featured = useMemo(() => pickFeaturedModels(models), [models]);
  const providerSummaries = useMemo(
    () => buildProviderSummaries(models, providers),
    [models, providers],
  );

  const trimmedQuery = deferredQuery.trim();
  const searching = trimmedQuery.length > 0;

  const modelMatches = useMemo(() => {
    if (!trimmedQuery) return featured;
    return models.filter((model) => matches(model.search_text, trimmedQuery));
  }, [models, featured, trimmedQuery]);

  const providerMatches = useMemo(() => {
    if (!trimmedQuery) return providerSummaries;
    return providerSummaries.filter((provider) => matches(provider.search_text, trimmedQuery));
  }, [providerSummaries, trimmedQuery]);

  const visibleModels = searching ? modelMatches.slice(0, SEARCH_VISIBLE) : modelMatches;
  const hiddenModels = searching ? modelMatches.length - visibleModels.length : 0;
  const visibleProviders = providerMatches.slice(0, SEARCH_VISIBLE);
  const hiddenProviders = providerMatches.length - visibleProviders.length;

  const switchView = (next: 'models' | 'providers') => {
    if (next === view) return;
    setView(next);
    setQuery('');
  };

  const applyCodingShortcut = (queryValue: string) => {
    setView('models');
    setQuery(queryValue);
  };

  // Drives the two controls a human already uses, so an agent can hand the page
  // back in the state the conversation reached. Stable identity keeps the WebMCP
  // effect from re-registering its tools on every render.
  const showInPage = useCallback(({ query: nextQuery, view: nextView }: ShowInPageRequest) => {
    setView(nextView);
    setQuery(nextQuery);
  }, []);

  // Only what the tools read. `provider_status` stays on the server: its
  // `error` strings are scraper diagnostics, not something to ship to browsers.
  const priceIndex: PriceIndex = useMemo(
    () => ({ models, providers, generated_at: generatedAt }),
    [models, providers, generatedAt],
  );

  return (
    <>
      <WebMcpTools index={priceIndex} showInPage={showInPage} />
      <div className="hero">
        <div className="shell">
          <p className="eyebrow">For humans and AI agents</p>
          <h1>Compare the AI inference market or let your agent do it</h1>
          <p className="hero__lead">
            Fresh, normalized pricing across a curated set of public AI inference providers.
            Through WebMCP, AI agents can search models, compare providers, calculate real workload
            costs, and hand the result back to the page.
          </p>

          <div className="search">
            <label className="visually-hidden" htmlFor={inputId}>
              {view === 'models' ? 'Search for an AI model' : 'Search for an API provider'}
            </label>
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                view === 'models'
                  ? 'Search Claude, GPT, Gemini, DeepSeek…'
                  : 'Search Surplus, CometAPI, TokenMix…'
              }
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

          <p className="hint">
            WebMCP enabled <span className="readout__sep">·</span> Ask your agent: Compare Claude
            Opus 5 and GPT-5.6 Sol for 50M input + 10M output tokens.
          </p>

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

          {view === 'models' ? (
            <>
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
              <div className={styles.codingShortcuts}>
                <span>Coding model shortcuts</span>
                {CODING_SHORTCUTS.map((shortcut) => (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => applyCodingShortcut(shortcut.query)}
                  >
                    {shortcut.label}
                  </button>
                ))}
                <small>Model-price shortcuts only; provider tool support varies.</small>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="results">
        <div className="shell">
          <div className={styles.viewSwitch} role="group" aria-label="Browse prices by">
            <button
              type="button"
              data-active={view === 'models' ? 'true' : 'false'}
              aria-pressed={view === 'models'}
              onClick={() => switchView('models')}
            >
              Models
            </button>
            <button
              type="button"
              data-active={view === 'providers' ? 'true' : 'false'}
              aria-pressed={view === 'providers'}
              onClick={() => switchView('providers')}
            >
              Providers
            </button>
          </div>

          {view === 'models' ? (
            <>
              <p className="results__meta" role="status">
                {searching
                  ? `${pluralise(modelMatches.length, 'model')} matching “${trimmedQuery}”`
                  : `${pluralise(visibleModels.length, 'featured model')} · search all ${pluralise(models.length, 'model')}`}
              </p>

              {visibleModels.length === 0 ? (
                <div className="empty">
                  <h2>No model matches “{trimmedQuery}”</h2>
                  <p>
                    Coverage currently comes from {pluralise(providerCount, 'provider')}. Try a
                    shorter model or family name such as “opus”, “gpt” or “deepseek”.
                  </p>
                  <button type="button" className="button-quiet" onClick={() => setQuery('')}>
                    Back to featured models
                  </button>
                </div>
              ) : (
                <div className="index">
                  {visibleModels.map((model) => (
                    <ModelCard key={model.id} model={model} providers={providers} now={now} />
                  ))}
                </div>
              )}

              {hiddenModels > 0 ? (
                <p className={`results__meta ${styles.moreResults}`}>
                  {hiddenModels} more {hiddenModels === 1 ? 'match is' : 'matches are'} hidden —
                  narrow the search to see them.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="results__meta" role="status">
                {searching
                  ? `${pluralise(providerMatches.length, 'provider')} matching “${trimmedQuery}”`
                  : `${pluralise(providerSummaries.length, 'provider')} with prices · sorted by model coverage`}
              </p>

              {visibleProviders.length === 0 ? (
                <div className="empty">
                  <h2>No provider matches “{trimmedQuery}”</h2>
                  <p>Try a shorter provider name or return to the full provider list.</p>
                  <button type="button" className="button-quiet" onClick={() => setQuery('')}>
                    Show all providers
                  </button>
                </div>
              ) : (
                <div className="index">
                  <table className="offers">
                    <caption className="visually-hidden">
                      Integrated providers, sorted by current model coverage
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Provider</th>
                        <th scope="col">Models</th>
                        <th scope="col">Cheapest</th>
                        <th scope="col">Updated</th>
                        <th scope="col">
                          <span className="visually-hidden">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProviders.map((provider) => (
                        <tr key={provider.id}>
                          <td data-label="Provider">
                            <a
                              className={styles.providerLink}
                              href={provider.visit_url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                            >
                              {provider.name}
                            </a>
                          </td>
                          <td data-label="Models" className="num num--lead">
                            {provider.model_count}
                          </td>
                          <td data-label="Cheapest" className="num num--muted">
                            {provider.cheapest_count}
                          </td>
                          <td data-label="Updated" className="num num--muted">
                            {provider.latest_observed_at ? (
                              <time
                                dateTime={provider.latest_observed_at}
                                title={utcStamp(provider.latest_observed_at)}
                              >
                                {updatedLabel(provider.latest_observed_at, now)}
                              </time>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td data-label="Visit">
                            <a
                              className="visit"
                              href={provider.visit_url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              aria-label={`Visit ${provider.name}`}
                            >
                              Visit
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {hiddenProviders > 0 ? (
                <p className={`results__meta ${styles.moreResults}`}>
                  {hiddenProviders} more {hiddenProviders === 1 ? 'provider is' : 'providers are'}
                  hidden — narrow the search to see them.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
