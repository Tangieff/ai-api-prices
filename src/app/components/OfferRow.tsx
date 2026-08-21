import { formatUsd } from '@/lib/money';
import type { OfferView, ProviderRef } from '@/lib/view';
import { updatedLabel, utcStamp } from './format';

/**
 * One provider's price for one model.
 *
 * Every `<td>` carries `data-label`, which the stylesheet prints as the field
 * name once the table collapses into cards on narrow screens — so the mobile
 * layout needs no separate markup. `data-empty` lets those card layouts drop
 * cells that would otherwise read "Cache —".
 */
export function OfferRow({
  offer,
  provider,
  now,
}: {
  offer: OfferView;
  provider: ProviderRef;
  now: number | null;
}) {
  const hasCache = offer.cache_read_usd_per_1m !== null || offer.cache_write_usd_per_1m !== null;

  return (
    <tr data-best={offer.is_best ? 'true' : 'false'}>
      <td data-label="Provider">
        <span className="provider">
          <span className="provider__name">{provider.name}</span>
          {offer.is_best ? <span className="badge-best">Cheapest</span> : null}
          {offer.tier ? <span className="tag-tier">{offer.tier}</span> : null}
          {provider.source_kind === 'seed' ? <span className="tag-seed">seeded</span> : null}
          {offer.stale ? <span className="tag-stale">stale</span> : null}
        </span>
      </td>

      <td data-label="Input / 1M" className="num num--lead">
        {formatUsd(offer.input_usd_per_1m)}
      </td>

      <td data-label="Output / 1M" className="num num--lead">
        {formatUsd(offer.output_usd_per_1m)}
      </td>

      <td data-label="Cache R / W" className="num num--muted" data-empty={hasCache ? 'false' : 'true'}>
        {hasCache
          ? `${formatUsd(offer.cache_read_usd_per_1m)} / ${formatUsd(offer.cache_write_usd_per_1m)}`
          : '—'}
      </td>

      <td data-label="Save" data-empty={offer.discount_pct === null ? 'true' : 'false'}>
        {offer.discount_pct !== null ? (
          <span className="badge-save">−{offer.discount_pct.toFixed(offer.discount_pct % 1 === 0 ? 0 : 1)}%</span>
        ) : (
          <span className="num num--muted">—</span>
        )}
      </td>

      <td data-label="Updated" className="num num--muted">
        <time dateTime={offer.observed_at} title={utcStamp(offer.observed_at)}>
          {updatedLabel(offer.observed_at, now)}
        </time>
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
  );
}
