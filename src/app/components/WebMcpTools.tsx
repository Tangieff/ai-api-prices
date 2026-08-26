'use client';

import { useEffect, useRef } from 'react';
import type { PriceIndex } from '@/lib/webmcp/catalog';
import { registerWebMcpTools } from '@/lib/webmcp/register';
import { buildWebMcpTools, type ShowInPageRequest } from '@/lib/webmcp/tools';

/**
 * Registers the page's WebMCP tools, and nothing else.
 *
 * This is progressive enhancement in the strict sense: it renders no markup and
 * touches no browser global until the effect runs, so server rendering and
 * hydration are unaffected — there is no output to mismatch — and a browser
 * without WebMCP behaves exactly as it always did.
 *
 * The index is read through a ref rather than captured in the tool closures.
 * The page re-renders itself every five minutes (and on tab focus) via
 * `router.refresh()`, which produces a new `PageData` object each time; keying
 * the tools on that object would tear down and re-register all five on every
 * refresh, firing `toolchange` at an agent in the middle of a conversation. The
 * ref keeps the tools stable for the lifetime of the mount while every call
 * still reads the newest prices.
 *
 * The registration and teardown rules live in `lib/webmcp/register` so they can
 * be tested directly; this component only ties them to the component lifetime.
 */
interface WebMcpToolsProps {
  index: PriceIndex;
  /** Must be referentially stable, or the effect re-registers on every render. */
  showInPage?: (request: ShowInPageRequest) => void;
}

export function WebMcpTools({ index, showInPage }: WebMcpToolsProps) {
  const indexRef = useRef(index);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Built inside the effect, never during render: the tools are not rendering
  // state, and the ref they read is only dereferenced later, when an agent
  // actually calls one.
  useEffect(
    () => registerWebMcpTools(buildWebMcpTools({ data: () => indexRef.current, showInPage })),
    [showInPage],
  );

  return null;
}
