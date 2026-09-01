'use client';

import { useMemo } from 'react';
import { buildVerificationRows, summariseVerification } from '@/lib/verification';
import { ProviderVerification } from './ProviderVerification';

/**
 * Data entry point for the transparency view.
 *
 * The records are static research, not part of the five-minute price refresh, so
 * there is nothing for the server to compute per request. Building them here —
 * inside a chunk the explorer only imports when someone opens Verification —
 * keeps roughly 60KB of evidence, notes and source URLs out of the payload of
 * every homepage request made by the many people who only came for prices.
 *
 * `ProviderVerification` keeps taking rows as props: it stays a pure function of
 * its data, which is what makes it straightforward to test.
 */
export default function VerificationPanel({
  query,
  onClearQuery,
}: {
  query: string;
  onClearQuery: () => void;
}) {
  const rows = useMemo(() => buildVerificationRows(), []);
  const summary = useMemo(() => summariseVerification(rows), [rows]);

  return (
    <ProviderVerification
      rows={rows}
      summary={summary}
      query={query}
      onClearQuery={onClearQuery}
    />
  );
}
