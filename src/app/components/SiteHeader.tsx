import Link from 'next/link';
import { SITE } from '@/lib/site';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="wordmark" href="/">
          <span className="wordmark__mark">OXWEB</span>
          <span>Prices</span>
        </Link>
        <a className="header-link" href={SITE.oxwebUrl} rel="noopener noreferrer">
          OXWeb ecosystem →
        </a>
      </div>
    </header>
  );
}
