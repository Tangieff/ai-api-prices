/**
 * Refresh every provider's prices and rewrite `data/prices.json`.
 *
 *   npm run refresh-prices
 *
 * Exit codes:
 *   0  every adapter succeeded
 *   1  at least one adapter failed (the dataset is still written, with the
 *      failing providers' previous offers carried forward and the error recorded)
 *   2  the run could not write a dataset at all
 *
 * A non-zero exit is a signal for whoever runs the command, not a failure of the
 * site: the site always renders the last usable dataset.
 */
import { loadDataset, saveDataset, DATASET_PATH } from '../src/lib/dataset';
import { refresh } from '../src/refresh/run';

async function main(): Promise<number> {
  const started = Date.now();
  const previous = await loadDataset();

  console.log('Refreshing provider prices…\n');
  const { dataset, statuses } = await refresh({
    previous,
    onProgress: (message) => console.log(`  ${message}`),
  });

  await saveDataset(dataset);

  const failed = statuses.filter((status) => !status.ok);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\nWrote ${dataset.offers.length} offers across ${dataset.models.length} models`);
  console.log(`  -> ${DATASET_PATH}`);
  console.log(`  ${statuses.length - failed.length}/${statuses.length} providers ok in ${elapsed}s`);

  if (failed.length > 0) {
    console.error('\nProviders that failed this run:');
    for (const status of failed) {
      console.error(`  ${status.provider_id}: ${status.error}`);
      if (status.stale) {
        console.error(`    kept ${status.offer_count} offers from ${status.last_success_at}`);
      }
    }
    return 1;
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error('Refresh failed before a dataset could be written:');
    console.error(error);
    process.exitCode = 2;
  });
