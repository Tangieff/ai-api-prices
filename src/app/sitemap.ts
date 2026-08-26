import type { MetadataRoute } from 'next';
import { loadDataset } from '@/lib/dataset';
import { SITE } from '@/lib/site';
import { buildPageData } from '@/lib/view';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = buildPageData(await loadDataset());
  const lastModified = data.generated_at ? new Date(data.generated_at) : new Date();

  return [
    {
      url: `${SITE.url}/`,
      lastModified,
      changeFrequency: 'hourly',
      priority: 1,
    },
    ...data.models.map((model) => ({
      url: `${SITE.url}/models/${encodeURIComponent(model.id)}`,
      lastModified,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
  ];
}
