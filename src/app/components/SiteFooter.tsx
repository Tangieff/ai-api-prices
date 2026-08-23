import { COST_SCORE_LABEL } from '@/lib/score';
import type { ProviderStatusView } from '@/lib/view';
import { utcStamp } from './format';
import styles from './discovery.module.css';

/**
 * Footer: where the numbers came from and how they were combined.
 *
 * Per-provider status lives here rather than in an alert banner. A provider
 * whose refresh failed still has usable prices from the previous run, so
 * surfacing it as a page-level error would be wrong — but hiding it entirely
 * would make a stale column look fresh.
 */
export function SiteFooter({
  providerStatus,
  generatedAt,
}: {
  providerStatus: ProviderStatusView[];
  generatedAt: string | null;
}) {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <section>
            <h2>Price sources</h2>
            <ul className="source-list">
              {providerStatus.map((status) => (
                <li key={status.provider_id}>
                  <span className="source-list__head">
                    <a
                      href={status.visit_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      {status.name}
                    </a>
                    <span className="tag-tier">
                      {status.source_kind === 'api'
                        ? 'public API'
                        : status.source_kind === 'html'
                          ? 'public page'
                          : 'manual seed'}
                    </span>
                    <a
                      className={styles.sourceLink}
                      href={status.pricing_source_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      pricing source
                    </a>
                    {!status.ok ? <span className="tag-stale">refresh failed</span> : null}
                    <span className="source-list__count">
                      {status.offer_count > 0 ? `${status.offer_count} offers` : 'no prices'}
                    </span>
                  </span>
                  <span className="source-list__blurb">{status.blurb}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>How prices are ranked</h2>
            <p>
              Within a model, offers are sorted cheapest first by a single score:{' '}
              <strong>{COST_SCORE_LABEL}</strong> per million tokens. Output is weighted more
              heavily because it is priced several times higher than input. Offers missing a price
              are not comparable and sort last.
            </p>
            <p>
              A <strong>Save</strong> badge appears only where the provider publishes its own list
              or direct price to compare against. Where no meaningful reference exists, the absolute
              prices are shown and the badge is omitted.
            </p>
          </section>

          <section>
            <h2>About the data</h2>
            <p>
              All figures are prices published by the providers themselves, read from the sources
              listed here and stored with the time they were observed. Prices change without notice
              — check the provider before committing spend.
            </p>
            <p>
              A provider whose refresh fails keeps its previous prices, marked{' '}
              <span className="tag-stale">stale</span>, rather than disappearing from the
              comparison.
            </p>
          </section>
        </div>

        <p className="colophon">
          OXWeb Prices · prices last refreshed{' '}
          {generatedAt ? <time dateTime={generatedAt}>{utcStamp(generatedAt)}</time> : 'never'} ·
          some provider links are referral links; referral status never affects price ranking
        </p>
      </div>
    </footer>
  );
}
