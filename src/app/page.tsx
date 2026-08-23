import { loadDataset } from '@/lib/dataset';
import { buildPageData } from '@/lib/view';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { PriceExplorer } from './components/PriceExplorer';

/**
 * The homepage — the entire product.
 *
 * Reads the generated dataset on the server, shapes it once, and hands it to
 * the client explorer for search. `loadDataset` never throws, so a missing or
 * unreadable data file renders the "no prices yet" state instead of a 500.
 */

// Re-read the dataset periodically so `npm run refresh-prices` shows up in a
// long-running `next start` without a rebuild.
export const revalidate = 300;

export default async function HomePage() {
  const data = buildPageData(await loadDataset());

  if (data.models.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="results">
          <div className="shell">
            <div className="empty">
              <h2>No price data yet</h2>
              <p>
                Nothing has been collected from the providers. Run{' '}
                <code>npm run refresh-prices</code> to populate <code>data/prices.json</code>, then
                reload this page.
              </p>
            </div>
          </div>
        </main>
        <SiteFooter generatedAt={data.generated_at} />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main>
        <PriceExplorer
          models={data.models}
          providers={data.providers}
          totalOffers={data.total_offers}
          providerCount={data.provider_status.length}
          providersWithPrices={
            data.provider_status.filter((status) => status.offer_count > 0).length
          }
        />
      </main>
      <SiteFooter generatedAt={data.generated_at} />
    </>
  );
}
