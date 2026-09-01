'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { VerificationRow, VerificationSummary } from '@/lib/verification';
import {
  ALL_FILTER,
  VERIFICATION_FILTERS,
  type VerificationFilterKey,
} from '@/lib/verification/filters';
import { matches } from '@/lib/search';
import { pluralise, reviewedLabel } from './format';
import styles from './verification.module.css';

/**
 * Provider transparency.
 *
 * This view answers "what can the public establish about who operates this
 * provider" and deliberately nothing else. Every number on screen is derived
 * from the researched records, every claim carries the source that supports it,
 * and anything we could not establish is printed as missing rather than omitted.
 *
 * Two things it must never become. It is not a safety rating — no provider is
 * ever labelled safe, unsafe, trusted or a scam. And it is not an investigation
 * report: the top of the page states what we found, not how many providers
 * failed to prove themselves. Not finding a person is a gap in the public
 * record, not a finding about the provider.
 */

const SOURCE_TAG: Record<string, string> = {
  first_party: 'Provider',
  registry: 'Registry',
  profile: 'Profile',
  interview: 'Interview',
  third_party: 'Independent',
  search_result: 'Search result',
};

const CHANNEL_LABEL: { key: keyof VerificationRow['official_presence']; label: string }[] = [
  { key: 'website', label: 'Website' },
  { key: 'docs', label: 'Documentation' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'github', label: 'GitHub' },
  { key: 'x', label: 'X' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'chat', label: 'Community' },
  { key: 'support', label: 'Support' },
  { key: 'terms', label: 'Terms' },
  { key: 'privacy', label: 'Privacy' },
];

function tidyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^mailto:/, '').replace(/\/$/, '');
}

function operatorCell(row: VerificationRow) {
  if (row.operator_name) {
    return (
      <>
        {row.operator_name}
        {row.operator_role ? <span className={styles.entityNote}>{row.operator_role}</span> : null}
      </>
    );
  }
  const other = row.other_public_people[0];
  if (other) {
    return (
      <>
        {other.name}
        <span className={styles.entityNote}>{other.role}</span>
      </>
    );
  }
  if (row.operator_status === 'unknown') {
    return <span className={styles.muted}>Not established</span>;
  }
  return <span className={styles.muted}>Not identified</span>;
}

function entityCell(row: VerificationRow) {
  if (row.entity_name) {
    return (
      <>
        {row.entity_name}
        <span className={styles.entityNote}>
          {row.entity_status === 'verified' ? 'Independently registered' : 'Provider-stated'}
        </span>
      </>
    );
  }
  if (row.entity_status === 'unknown') {
    return <span className={styles.muted}>Not established</span>;
  }
  return <span className={styles.muted}>Not identified</span>;
}

/**
 * Everything below the drawer header.
 *
 * Split out from the panel chrome so the evidence rendering can be exercised
 * directly, without driving the list to open a drawer first.
 */
export function VerificationDetail({ row }: { row: VerificationRow }) {
  const channels = CHANNEL_LABEL.map((channel) => ({
    ...channel,
    url: row.official_presence[channel.key],
  })).filter((channel): channel is typeof channel & { url: string } => channel.url !== null);

  const operatorEvidence = row.evidence.filter(
    (item) => item.claim_type === 'founder' || item.claim_type === 'operator',
  );

  return (
    <>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Transparency level</p>
        <div className={styles.levelRow}>
          <span className={styles.chip} data-level={row.level}>
            {row.level_label}
          </span>
        </div>
        <p className={styles.levelBlurb}>{row.level_blurb}</p>
        {row.summary ? <p className={styles.summaryText}>{row.summary}</p> : null}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Public people</p>
        {row.operator_name ? (
          <div className={styles.person}>
            <p className={styles.personName}>{row.operator_name}</p>
            {row.operator_role ? <p className={styles.personRole}>{row.operator_role}</p> : null}
            {row.profile_urls.length > 0 ? (
              <p className={styles.personLinks}>
                {row.profile_urls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow">
                    {tidyUrl(url)}
                  </a>
                ))}
              </p>
            ) : null}
            {operatorEvidence.map((item) => (
              <p key={item.url} className={styles.personEvidence}>
                “{item.note}”{' '}
                <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
                  {item.source_name}
                </a>
              </p>
            ))}
          </div>
        ) : (
          <p className={styles.summaryText}>
            {row.operator_status === 'unknown'
              ? 'We could not establish who operates this provider from the public record.'
              : 'Public founder or operator not identified.'}
          </p>
        )}

        {row.other_public_people.length > 0 ? (
          <ul className={styles.people}>
            {row.other_public_people.map((person) => (
              <li key={person.name}>
                <span className={styles.personName}>{person.name}</span>
                <span className={styles.personRole}>{person.role}</span>
                {person.url ? (
                  <a href={person.url} target="_blank" rel="noopener noreferrer nofollow">
                    {tidyUrl(person.url)}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Company or entity</p>
        {row.entity_name ? (
          <div className={styles.person}>
            <p className={styles.personName}>
              {row.entity_name}
              {row.entity_jurisdiction ? ` — ${row.entity_jurisdiction}` : ''}
            </p>
            <p className={styles.personRole}>
              {row.entity_status === 'verified'
                ? 'Independently registered entity'
                : 'Provider-stated entity'}
            </p>
            <p className={styles.personEvidence}>
              {row.entity_status === 'verified'
                ? 'An independent registration record was found for this company.'
                : 'The provider names this company in its own material. We could not confirm it against an independent registry.'}
            </p>
            {row.registration_reference ? (
              <p className={styles.personLinks}>
                <a
                  href={row.registration_reference}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {tidyUrl(row.registration_reference)}
                </a>
              </p>
            ) : null}
          </div>
        ) : (
          <p className={styles.summaryText}>
            {row.entity_status === 'unknown'
              ? 'We could not establish a company from the public record.'
              : 'No company is named on the provider’s public surfaces.'}
          </p>
        )}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>
          Transparency signals
          <span className={styles.levelCount}>
            {row.signals_found} of {row.signal_total} found
          </span>
        </p>
        <ul className={styles.signals}>
          {row.signals.map((signal) => (
            <li key={signal.key} className={styles.signal}>
              <span className={styles.signalLabel}>
                {signal.label}
                <span className={styles.signalDetail}>{signal.detail}</span>
              </span>
              <span className={`${styles.chip} ${styles.signalState}`} data-state={signal.state}>
                {signal.state === 'found'
                  ? 'Found'
                  : signal.state === 'partial'
                    ? 'Partial'
                    : 'Not found'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {channels.length > 0 ? (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Official channels</p>
          <ul className={styles.channels}>
            {channels.map((channel) => (
              <li key={channel.key}>
                <span className={styles.channelLabel}>{channel.label}</span>
                <a href={channel.url} target="_blank" rel="noopener noreferrer nofollow">
                  {tidyUrl(channel.url)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.section}>
        <p className={styles.sectionTitle}>
          {row.evidence.length > 0 ? 'Evidence we found' : 'Evidence'}
        </p>
        {row.evidence.length > 0 ? (
          <ul className={styles.evidence}>
            {row.evidence.map((item) => (
              <li key={`${item.claim_type}-${item.url}`} className={styles.evidenceItem}>
                <div className={styles.evidenceHead}>
                  <a
                    className={styles.evidenceLink}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {item.label}
                  </a>
                  <span className={styles.sourceTag}>
                    {SOURCE_TAG[item.source_type] ?? item.source_type}
                  </span>
                </div>
                <p className={styles.evidenceNote}>{item.note}</p>
                <p className={styles.evidenceMeta}>
                  {item.source_name} · checked{' '}
                  <time dateTime={item.checked_at}>{reviewedLabel(item.checked_at)}</time>
                  {item.opened ? '' : ' · read through a search index only'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.summaryText}>No sources have been recorded yet.</p>
        )}
      </div>

      {row.unknowns.length > 0 ? (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>What remains unknown</p>
          <ul className={styles.unknowns}>
            {row.unknowns.map((unknown) => (
              <li key={unknown}>{unknown}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.drawerFoot}>
        <p className={styles.caveat}>
          Transparency reflects publicly available information. It does not guarantee service
          safety, legality, model authenticity, availability or quality.
          {row.reviewed && row.last_reviewed_at
            ? ` Last reviewed ${reviewedLabel(row.last_reviewed_at)}.`
            : ''}
        </p>
      </div>
    </>
  );
}

interface ProviderVerificationProps {
  rows: VerificationRow[];
  summary: VerificationSummary;
  /** The shared header search term, already trimmed. */
  query: string;
  onClearQuery: () => void;
}

export function ProviderVerification({
  rows,
  summary,
  query,
  onClearQuery,
}: ProviderVerificationProps) {
  const [filter, setFilter] = useState<VerificationFilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drawerId = useId();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // The control that opened the drawer, so focus can go back where it started.
  const triggerRef = useRef<HTMLElement | null>(null);

  const searching = query.length > 0;

  const searched = useMemo(
    () => (searching ? rows.filter((row) => matches(row.search_text, query)) : rows),
    [rows, query, searching],
  );

  // Chip counts describe the rows a search has already narrowed to, so a chip
  // never advertises matches the current search cannot show.
  const filterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of VERIFICATION_FILTERS) {
      counts.set(entry.key, searched.filter(entry.test).length);
    }
    return counts;
  }, [searched]);

  const activeFilter = VERIFICATION_FILTERS.find((entry) => entry.key === filter) ?? ALL_FILTER;
  const visible = useMemo(() => searched.filter(activeFilter.test), [searched, activeFilter]);

  // Anchored to every row, not to the filtered ones. Deriving it from `visible`
  // meant a search could unmount an open modal with focus still inside it, and
  // the search box is reachable while the drawer is open through the agent tool
  // that drives it. Filter changes close the drawer explicitly instead, which
  // restores focus properly. Covered by the interaction tests.
  const selected = useMemo(
    () => (selectedId ? (rows.find((row) => row.provider_id === selectedId) ?? null) : null),
    [rows, selectedId],
  );

  const open = useCallback((row: VerificationRow, trigger: HTMLElement | null) => {
    triggerRef.current = trigger;
    setSelectedId(row.provider_id);
  }, []);

  const close = useCallback(() => {
    setSelectedId(null);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    // Focus has to move before the element is unmounted or the browser drops it
    // on the body, which loses the reader's place in the list.
    if (trigger?.isConnected) trigger.focus();
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = drawerRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      const active = document.activeElement;
      // Focus can end up outside the panel without ever passing through its
      // edges — on the body after a focused element is removed, or on the panel
      // container itself. Wrapping only at the boundaries would let the next Tab
      // walk off into the page behind an aria-modal dialog.
      if (!(active instanceof HTMLElement) || !panel.contains(active) || active === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedId, close]);

  // The cards describe what was found. An earlier version led with how many
  // providers could not be confirmed, which turned a reference table into an
  // accusation and told a reader nothing they could act on.
  const cards: { value: number; label: string; level: string }[] = [
    { value: summary.high, label: 'High transparency', level: 'high' },
    { value: summary.any_public_person, label: 'Public founder or operator', level: 'person' },
    { value: summary.named_company, label: 'Named company or entity', level: 'company' },
    { value: summary.needs_review, label: 'Needs further verification', level: 'limited' },
  ];

  return (
    <>
      <div className={styles.intro}>
        <div className={styles.introHead}>
          <h2>Provider transparency</h2>
        </div>
        <p>
          Public identity and company information we found for{' '}
          {pluralise(summary.total, 'API provider')}. Each record links the sources it rests on and
          says plainly what we could not establish.
        </p>
      </div>

      <div className={styles.cards}>
        {cards.map((card) => (
          <div key={card.label} className={styles.card} data-level={card.level}>
            <p className={styles.cardValue}>
              <span className="num">{card.value}</span>
              <span className={styles.cardTotal}>/ {summary.total}</span>
            </p>
            <p className={styles.cardLabel}>{card.label}</p>
          </div>
        ))}
      </div>

      <div className={styles.filters} role="group" aria-label="Filter providers by evidence">
        {VERIFICATION_FILTERS.map((entry) => {
          const count = filterCounts.get(entry.key) ?? 0;
          const isActive = entry.key === activeFilter.key;
          return (
            <button
              key={entry.key}
              type="button"
              aria-pressed={isActive}
              disabled={count === 0 && !isActive}
              onClick={() => {
                setFilter(entry.key);
                // The open provider may not survive the new filter, and a drawer
                // describing a hidden row is worse than none.
                close();
              }}
            >
              {entry.label}
              <span className={styles.filterCount}>{count}</span>
            </button>
          );
        })}
      </div>

      <p className="results__meta" role="status">
        {searching
          ? `${pluralise(visible.length, 'provider')} matching “${query}”`
          : `${pluralise(visible.length, 'provider')} · last reviewed dates shown per record`}
      </p>

      {visible.length === 0 ? (
        <div className="empty">
          <h2>No provider matches this view</h2>
          <p>
            {searching
              ? 'Try a shorter provider name, or clear the search.'
              : 'Choose a different filter to see the full set of records.'}
          </p>
          <button
            type="button"
            className="button-quiet"
            onClick={() => {
              setFilter('all');
              if (searching) onClearQuery();
            }}
          >
            Show all providers
          </button>
        </div>
      ) : (
        <div className="index">
          <table className={`offers ${styles.table}`}>
            <caption className="visually-hidden">
              Provider transparency records, strongest public evidence first
            </caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Transparency</th>
                <th scope="col">Founder / operator</th>
                <th scope="col">Company</th>
                <th scope="col">Official channels</th>
                <th scope="col">Last reviewed</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const isSelected = row.provider_id === selectedId;
                // The row click is a pointer convenience only. The provider name
                // is a real button and is the sole keyboard path: the row itself
                // is deliberately not focusable, so there is one tab stop per
                // provider rather than two.
                return (
                  <tr
                    key={row.provider_id}
                    data-selected={isSelected ? 'true' : 'false'}
                    onClick={(event) => open(row, event.currentTarget.querySelector('button'))}
                  >
                    <td data-label="Provider">
                      <button
                        type="button"
                        className={styles.nameButton}
                        aria-haspopup="dialog"
                        aria-expanded={isSelected}
                        // Only points at the panel while the panel exists.
                        {...(isSelected ? { 'aria-controls': drawerId } : {})}
                        onClick={(event) => {
                          event.stopPropagation();
                          open(row, event.currentTarget);
                        }}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td data-label="Transparency">
                      <span className={styles.chip} data-level={row.level}>
                        {row.level_label}
                      </span>
                    </td>
                    <td data-label="Founder / operator">{operatorCell(row)}</td>
                    <td data-label="Company">{entityCell(row)}</td>
                    <td data-label="Official channels" className="num num--muted">
                      {row.published_surface_count} of {row.presence_total}
                    </td>
                    <td data-label="Last reviewed" className="num num--muted">
                      {row.reviewed && row.last_reviewed_at ? (
                        <time dateTime={row.last_reviewed_at}>
                          {reviewedLabel(row.last_reviewed_at)}
                        </time>
                      ) : (
                        <span className={styles.muted}>Not reviewed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <details className={styles.method}>
        <summary>How these records are built</summary>
        <div className={styles.methodBody}>
          <p>
            Each provider is researched by hand from its own public surfaces and, for identity, from
            sources independent of the provider. A level is then derived mechanically, so the same
            evidence always produces the same result.
          </p>
          <dl>
            <dt>High transparency</dt>
            <dd>
              A person who publicly operates the service, or a registered company, is substantiated
              by independent sources, and at least four official channels were established.
            </dd>
            <dt>Moderate transparency</dt>
            <dd>
              An operator or company is identifiable from public material and at least three
              official channels were established, but one of the two bars for high transparency is
              not met.
            </dd>
            <dt>Limited transparency</dt>
            <dd>
              The service publishes real official channels, but we could not establish who operates
              it.
            </dd>
            <dt>Unverified</dt>
            <dd>Not enough public information has been collected to say.</dd>
          </dl>
          <ul>
            <li>
              A <b>public founder or operator</b> is an accountability signal, not a company
              registration. A person counts when public evidence connects them directly to the
              service — their own statement of what they run, the provider linking them, official
              material naming them, or a credible profile or interview.
            </li>
            <li>
              A <b>provider-stated</b> company is one the provider names in its own Terms, Privacy
              or About. Anyone can publish legal-looking text, so that is a claim.{' '}
              <b>Independently registered</b> means a registry record was found.
            </li>
            <li>
              Missing information is shown as missing. A blank field means we looked and did not
              find it — never that the provider is hiding something.
            </li>
            <li>
              A page that is served but renders its text in the browser counts as a published
              channel, but not as an established one.
            </li>
            <li>
              Records are reviewed manually and carry the date of that review. Providers change
              their public material without notice.
            </li>
          </ul>
        </div>
      </details>

      {selected ? (
        <>
          <button
            type="button"
            className={styles.scrim}
            aria-label="Close provider details"
            tabIndex={-1}
            onClick={close}
          />
          <div
            id={drawerId}
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${drawerId}-title`}
          >
            <div className={styles.drawerHead}>
              <div>
                <h2 id={`${drawerId}-title`}>{selected.name}</h2>
                <a
                  className={styles.drawerSite}
                  href={selected.website_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {tidyUrl(selected.website_url)}
                </a>
              </div>
              <button type="button" ref={closeRef} className={styles.close} onClick={close}>
                <span aria-hidden="true">×</span>
                <span className="visually-hidden">Close</span>
              </button>
            </div>

            <VerificationDetail row={selected} />
          </div>
        </>
      ) : null}
    </>
  );
}
