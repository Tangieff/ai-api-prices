import { utcStamp } from './format';

/** Compact site identity and freshness marker. */
export function SiteFooter({ generatedAt }: { generatedAt: string | null }) {
  return (
    <footer className="site-footer">
      <div className="shell">
        <p className="colophon">
          AI API Prices &middot; prices last refreshed{' '}
          {generatedAt ? <time dateTime={generatedAt}>{utcStamp(generatedAt)}</time> : 'never'}
        </p>
      </div>
    </footer>
  );
}
