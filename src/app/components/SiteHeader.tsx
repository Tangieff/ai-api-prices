import Link from 'next/link';

/**
 * Masthead.
 *
 * OXWEB is the house name; PRICES is the index published under it, set smaller
 * and in the figure face to read as a product label rather than a second brand.
 * The cobalt rule above the header is the only ornament on the page.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="wordmark" href="/">
          <span className="wordmark__ox">OXWEB</span>
          <span className="wordmark__sep" aria-hidden="true">
            /
          </span>
          <span className="wordmark__product">PRICES</span>
        </Link>
      </div>
    </header>
  );
}
