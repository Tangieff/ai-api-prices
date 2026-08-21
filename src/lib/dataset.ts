import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Dataset } from './types';

/**
 * Dataset persistence.
 *
 * The whole catalogue is one generated JSON file. It is small (a few hundred
 * offers), it is committed to the repository so a fresh clone renders without
 * running a refresh first, and it needs no database, migration or running
 * service — which is the entire persistence story the MVP asks for.
 */

export const DATASET_PATH = path.join(process.cwd(), 'data', 'prices.json');

/**
 * A fresh empty dataset.
 *
 * Returned as a new object each call rather than shared as a constant: callers
 * sort and append to `offers`, and a shared instance would accumulate state
 * across refreshes.
 */
export function emptyDataset(): Dataset {
  return {
    version: 1,
    generated_at: '1970-01-01T00:00:00.000Z',
    providers: [],
    models: [],
    offers: [],
    provider_status: [],
  };
}

/**
 * Read the dataset, or return an empty one when the file is missing or
 * unreadable.
 *
 * Never throws: the public site must still render (as an "unavailable" state)
 * rather than 500 when the data file has not been generated yet.
 */
export async function loadDataset(): Promise<Dataset> {
  try {
    const parsed = JSON.parse(await readFile(DATASET_PATH, 'utf8')) as Dataset;
    if (parsed?.version !== 1 || !Array.isArray(parsed.offers)) return emptyDataset();
    return parsed;
  } catch {
    return emptyDataset();
  }
}

export async function saveDataset(dataset: Dataset): Promise<void> {
  await mkdir(path.dirname(DATASET_PATH), { recursive: true });
  await writeFile(DATASET_PATH, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
}
