import type { MetadataRoute } from 'next';
import { loadDataset } from '@/lib/dataset';
import { buildPageData } from '@/lib/view';

const SITE_URL = 'https://prices.oxweb.xyz';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = buildPageData(await loadDataset());
  const lastModified = data.generated_at ? new Date(data.generated_at) : new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'hourly',
      priority: 1,
    },
    ...data.models.map((model) => ({
      url: `${SITE_URL}/models/${encodeURIComponent(model.id)}`,
      lastModified,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
  ];
}
