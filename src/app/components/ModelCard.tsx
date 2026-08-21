import { formatUsd } from '@/lib/money';
import type { ModelView, ProviderRef } from '@/lib/view';
import { OfferRow } from './OfferRow';
import { pluralise } from './format';

/** One model and every provider selling it, cheapest first. */
export function ModelCard({
  model,
  providers,
  now,
}: {
  model: ModelView;
  providers: Record<string, ProviderRef>;
  now: number | null;
}) {
  return (
    <article className="model" aria-labelledby={`model-${model.id}`}>
      <header className="model__head">
        <h3 className="model__name" id={`model-${model.id}`}>
          {model.display_name}
        </h3>
        {model.maker ? <span className="chip">{model.maker}</span> : null}
        <span className="chip">{pluralise(model.provider_count, 'provider')}</span>
        <p className="model__summary">
          from <b>{formatUsd(model.best_input_usd_per_1m)}</b> in /{' '}
          <b>{formatUsd(model.best_output_usd_per_1m)}</b> out per 1M tokens
        </p>
      </header>

      <table className="offers">
        <caption className="visually-hidden">
          Providers offering {model.display_name}, cheapest first
        </caption>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">Input / 1M</th>
            <th scope="col">Output / 1M</th>
            <th scope="col">Cache R / W</th>
            <th scope="col">Save</th>
            <th scope="col">Updated</th>
            <th scope="col">
              <span className="visually-hidden">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {model.offers.map((offer) => {
            const provider = providers[offer.provider_id];
            if (!provider) return null;
            return (
              <OfferRow
                key={`${offer.provider_id}-${offer.tier ?? ''}`}
                offer={offer}
                provider={provider}
                now={now}
              />
            );
          })}
        </tbody>
      </table>
    </article>
  );
}
