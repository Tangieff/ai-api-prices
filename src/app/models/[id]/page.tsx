import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDataset } from '@/lib/dataset';
import { buildPageData } from '@/lib/view';
import { ModelCard } from '@/app/components/ModelCard';
import { SiteFooter } from '@/app/components/SiteFooter';
import { SiteHeader } from '@/app/components/SiteHeader';
import styles from './model-page.module.css';

export const revalidate = 300;

interface ModelPageProps {
  params: Promise<{ id: string }>;
}

async function getModel(id: string) {
  const data = buildPageData(await loadDataset());
  const model = data.models.find((candidate) => candidate.id === id) ?? null;
  return { data, model };
}

export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { id } = await params;
  const { model } = await getModel(id);
  if (!model) return { title: 'Model not found' };

  const providerLabel = model.provider_count === 1 ? 'provider' : 'providers';
  return {
    title: `${model.display_name} API prices`,
    description: `Compare published ${model.display_name} API prices across ${model.provider_count} discount inference ${providerLabel}. Input, output, cache and published savings in USD per million tokens.`,
    alternates: { canonical: `/models/${encodeURIComponent(model.id)}` },
  };
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { id } = await params;
  const { data, model } = await getModel(id);
  if (!model) notFound();

  return (
    <>
      <SiteHeader />
      <main>
        <div className={styles.head}>
          <div className="shell">
            <Link className={styles.back} href="/">
              ← All prices
            </Link>
            <p className="eyebrow">AI model price comparison</p>
            <h1>{model.display_name} API prices</h1>
            <p>
              Compare published prices from {model.provider_count} discount inference
              {model.provider_count === 1 ? ' provider' : ' providers'}. Prices are normalised to US
              dollars per million tokens and ranked with the same organic price score as the main
              index.
            </p>
          </div>
        </div>

        <div className="results">
          <div className="shell">
            <div className="index">
              <ModelCard model={model} providers={data.providers} now={null} />
            </div>
            <p className={styles.note}>
              Provider links may be referral links. Referral status never affects price ranking.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter providerStatus={data.provider_status} generatedAt={data.generated_at} />
    </>
  );
}
