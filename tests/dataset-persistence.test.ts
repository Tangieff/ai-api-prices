import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyDataset, saveDataset } from '@/lib/dataset';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('dataset persistence', () => {
  it('replaces an existing dataset through a temporary sibling file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ai-api-prices-dataset-'));
    temporaryDirectories.push(directory);

    const dataDirectory = join(directory, 'data');
    const datasetPath = join(dataDirectory, 'prices.json');

    await mkdir(dataDirectory, { recursive: true });
    await writeFile(datasetPath, '{"version":1,"offers":[]}\n', 'utf8');

    const dataset = {
      ...emptyDataset(),
      generated_at: '2026-08-23T12:00:00.000Z',
    };

    await saveDataset(dataset, datasetPath);

    const parsed = JSON.parse(await readFile(datasetPath, 'utf8')) as {
      generated_at: string;
      offers: unknown[];
    };
    expect(parsed.generated_at).toBe('2026-08-23T12:00:00.000Z');
    expect(parsed.offers).toEqual([]);
    expect(await readdir(dataDirectory)).toEqual(['prices.json']);
  });
});
