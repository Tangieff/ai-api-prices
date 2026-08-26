import Link from 'next/link';

/**
 * Masthead.
 *
 * AI API is the product name; PRICES is the index label, set smaller and in the
 * figure face to read as one compact wordmark.
 * The cobalt rule above the header is the only ornament on the page.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="wordmark" href="/">
          <span className="wordmark__ox">AI API</span>
          <span className="wordmark__sep" aria-hidden="true">
            /
          </span>
          <span className="wordmark__product">PRICES</span>
        </Link>
      </div>
    </header>
  );
}
