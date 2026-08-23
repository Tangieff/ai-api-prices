import { formatUsd } from '@/lib/money';
import type { OfferView, ProviderRef } from '@/lib/view';
import { formatPercent, updatedLabel, utcStamp } from './format';
import styles from './discovery.module.css';

/**
 * One provider's price for one model.
 *
 * Every `<td>` carries `data-label`, which the stylesheet prints as the field
 * name once the table collapses into cards on narrow screens — so the mobile
 * layout needs no separate markup. `data-empty` lets those card layouts drop
 * cells that would otherwise read "Cache —".
 *
 * Only the cheapest row carries the filled action. Giving every row the same
 * bright button would make the page a wall of equal calls to action and hide
 * the one answer the visitor came for.
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
          <a
            className={`provider__name ${styles.providerNameLink}`}
            href={provider.visit_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {provider.name}
          </a>
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
          <span className="badge-save">−{formatPercent(offer.discount_pct)}%</span>
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
          className={offer.is_best ? 'visit visit--primary' : 'visit'}
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
