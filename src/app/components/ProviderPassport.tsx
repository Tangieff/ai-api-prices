'use client';

import { useEffect, useMemo } from 'react';
import { buildVerificationRows, type VerificationRow } from '@/lib/verification';
import { reviewedLabel } from './format';
import styles from './provider-passport.module.css';

interface ProviderPassportProps {
  providerId: string | null;
  pinned: boolean;
  onRequestClose: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'x.com' || host === 'twitter.com') return 'X';
    if (host.includes('linkedin.com')) return 'LinkedIn';
    if (host.includes('github.com')) return 'GitHub';
    if (host === 't.me' || host.endsWith('.t.me')) return 'Telegram';
    if (host.includes('discord.gg') || host.includes('discord.com')) return 'Discord';
    if (host.includes('facebook.com')) return 'Facebook';
    if (host.includes('farcaster') || host.includes('warpcast')) return 'Farcaster';
    return host;
  } catch {
    return 'Profile';
  }
}

function uniqueLinks(links: { label: string; url: string }[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function officialLinks(row: VerificationRow) {
  const presence = row.official_presence;
  return uniqueLinks(
    [
      presence.x ? { label: 'X', url: presence.x } : null,
      presence.linkedin ? { label: 'LinkedIn', url: presence.linkedin } : null,
      presence.github ? { label: 'GitHub', url: presence.github } : null,
      presence.chat ? { label: linkLabel(presence.chat), url: presence.chat } : null,
      ...row.profile_urls.map((url) => ({ label: linkLabel(url), url })),
    ].filter((item): item is { label: string; url: string } => item !== null),
  );
}

function compactEvidence(row: VerificationRow) {
  const identity = row.evidence.filter((item) =>
    ['founder', 'operator', 'entity'].includes(item.claim_type),
  );
  const preferred = identity.length > 0 ? identity : row.evidence;
  return preferred.slice(0, 3);
}

export default function ProviderPassport({
  providerId,
  pinned,
  onRequestClose,
  onPointerEnter,
  onPointerLeave,
}: ProviderPassportProps) {
  const rows = useMemo(() => buildVerificationRows(), []);
  const row = useMemo(
    () => (providerId ? (rows.find((item) => item.provider_id === providerId) ?? null) : null),
    [providerId, rows],
  );

  useEffect(() => {
    if (!pinned || !row) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pinned, row, onRequestClose]);

  if (!row) return null;

  const links = officialLinks(row);
  const evidence = compactEvidence(row);

  return (
    <aside
      className={styles.passport}
      data-pinned={pinned ? 'true' : 'false'}
      role="dialog"
      aria-label={`${row.name} provider details`}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <div className={styles.head}>
        <div>
          <div className={styles.titleRow}>
            <h2>{row.name}</h2>
            <span className={styles.level} data-level={row.level}>
              {row.level_label}
            </span>
          </div>
          <a
            className={styles.website}
            href={row.website_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {row.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        </div>
        <button type="button" className={styles.close} onClick={onRequestClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className={styles.body}>
        <section className={styles.section}>
          <span className={styles.label}>Founder / operator</span>
          {row.operator_name ? (
            <div className={styles.primaryValue}>
              <strong>{row.operator_name}</strong>
              {row.operator_role ? <span>{row.operator_role}</span> : null}
            </div>
          ) : (
            <p className={styles.muted}>Not publicly identified</p>
          )}
        </section>

        <section className={styles.section}>
          <span className={styles.label}>Company</span>
          {row.entity_name ? (
            <div className={styles.primaryValue}>
              <strong>{row.entity_name}</strong>
              <span>
                {[row.entity_jurisdiction, row.entity_status === 'verified' ? 'registry confirmed' : 'provider stated']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          ) : (
            <p className={styles.muted}>No public company identified</p>
          )}
        </section>

        <section className={styles.section}>
          <span className={styles.label}>Official profiles</span>
          {links.length > 0 ? (
            <div className={styles.links}>
              {links.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                  {link.label}
                </a>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>No confirmed public profiles</p>
          )}
        </section>

        {evidence.length > 0 ? (
          <section className={styles.section}>
            <span className={styles.label}>Sources</span>
            <div className={styles.sources}>
              {evidence.map((item) => (
                <a
                  key={`${item.claim_type}-${item.url}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  title={item.note}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <div className={styles.foot}>
          <span>
            {row.reviewed && row.last_reviewed_at
              ? `Checked ${reviewedLabel(row.last_reviewed_at)}`
              : 'Not reviewed yet'}
          </span>
          <span>Public-source transparency, not a safety or model-authenticity guarantee.</span>
        </div>
      </div>
    </aside>
  );
}
