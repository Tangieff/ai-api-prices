import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from '@/app/components/SiteHeader';

describe('site header', () => {
  it('keeps the OXWEB / PRICES wordmark without an ecosystem link', () => {
    const html = renderToStaticMarkup(createElement(SiteHeader));

    expect(html).toContain('OXWEB');
    expect(html).toContain('PRICES');
    expect(html).not.toContain('OXWeb ecosystem');
    expect(html).not.toContain('oxweb.xyz');
    expect(html.match(/<a\b/g)).toHaveLength(1);
  });
});
