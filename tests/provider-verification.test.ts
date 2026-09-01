import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '@/lib/providers';
import {
  buildVerificationRows,
  deriveTransparencyLevel,
  entityStatus,
  founderStatus,
  indexRecords,
  operatorIsDisplayable,
  presenceCount,
  publishedSurfaceCount,
  signalsFound,
  summariseVerification,
  transparencySignals,
  VERIFICATION_RECORDS,
  type EvidenceRef,
  type ProviderVerificationRecord,
} from '@/lib/verification';
import { VERIFICATION_FILTERS } from '@/lib/verification/filters';
import { isCalendarDate, reviewedLabel } from '@/app/components/format';
import { ProviderVerification, VerificationDetail } from '@/app/components/ProviderVerification';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LINK = /^(https:\/\/[^\s"']+|mailto:[^\s"'@]+@[^\s"']+)$/;

/**
 * A record the tests can bend one field at a time. It starts with nothing
 * established, which is the state the layer must handle most carefully.
 */
function record(overrides: Partial<ProviderVerificationRecord> = {}): ProviderVerificationRecord {
  return {
    provider_id: 'test-provider',
    review_status: 'reviewed',
    last_reviewed_at: '2026-08-27',
    founder_operator: {
      status: 'not_found',
      public_name: null,
      role: null,
      profile_urls: [],
      strength: 'none',
    },
    other_public_people: [],
    legal_entity: {
      status: 'not_found',
      name: null,
      jurisdiction: null,
      registration_reference: null,
      strength: 'none',
    },
    official_presence: {
      website: null,
      docs: null,
      pricing: null,
      terms: null,
      privacy: null,
      github: null,
      x: null,
      linkedin: null,
      chat: null,
      support: null,
    },
    operating_history: null,
    evidence: [],
    summary: 'Test record.',
    unknowns: [],
    ...overrides,
  };
}

function presence(...keys: (keyof ProviderVerificationRecord['official_presence'])[]) {
  const base = record().official_presence;
  for (const key of keys) base[key] = `https://example.com/${key}`;
  return base;
}

function evidence(overrides: Partial<EvidenceRef> = {}): EvidenceRef {
  return {
    claim_type: 'entity',
    category: 'entity',
    label: 'Registry record',
    source_name: 'Company register',
    url: 'https://registry.example.com/1',
    source_type: 'registry',
    note: 'Company register entry for Example Ltd.',
    strength: 'strong',
    opened: true,
    checked_at: '2026-08-27',
    ...overrides,
  };
}

describe('verification dataset integrity', () => {
  it('keeps records unique and gives every active provider a researched record', () => {
    const ids = VERIFICATION_RECORDS.map((entry) => entry.provider_id).sort();
    const active = PROVIDERS.map((provider) => provider.id).sort();

    expect(new Set(ids).size).toBe(ids.length);
    expect(active.every((providerId) => ids.includes(providerId))).toBe(true);
  });

  it('refuses to build the index when a provider has two records', () => {
    const first = VERIFICATION_RECORDS[0]!;
    expect(() => indexRecords([first, { ...first }])).toThrow(/Duplicate/i);
  });

  it('records only URLs the site can actually link', () => {
    for (const entry of VERIFICATION_RECORDS) {
      for (const url of Object.values(entry.official_presence)) {
        if (url !== null) expect(url, `${entry.provider_id} presence`).toMatch(LINK);
      }
      for (const item of entry.evidence) {
        expect(item.url, `${entry.provider_id} evidence`).toMatch(LINK);
      }
      for (const url of entry.founder_operator.profile_urls) {
        expect(url, `${entry.provider_id} profile`).toMatch(LINK);
      }
      if (entry.legal_entity.registration_reference !== null) {
        expect(entry.legal_entity.registration_reference).toMatch(LINK);
      }
    }
  });

  it('never claims a status the evidence does not carry', () => {
    for (const entry of VERIFICATION_RECORDS) {
      // The derivation weakens an unsupported claim. If a shipped record needs
      // weakening, the record itself is wrong.
      expect(founderStatus(entry), `${entry.provider_id} operator`).toBe(
        entry.founder_operator.status,
      );
      expect(entityStatus(entry), `${entry.provider_id} entity`).toBe(entry.legal_entity.status);
    }
  });

  it('keeps missing identity explicitly empty rather than guessed', () => {
    for (const entry of VERIFICATION_RECORDS) {
      const operator = entry.founder_operator;
      if (operator.status === 'not_found' || operator.status === 'unknown') {
        expect(operator.public_name, entry.provider_id).toBeNull();
        expect(operator.role, entry.provider_id).toBeNull();
        expect(operator.strength, entry.provider_id).toBe('none');
      }
      const entity = entry.legal_entity;
      if (entity.status === 'not_found' || entity.status === 'unknown') {
        expect(entity.name, entry.provider_id).toBeNull();
        expect(entity.registration_reference, entry.provider_id).toBeNull();
      }
      // A provider-stated company must not carry a registration reference: that
      // reference is exactly what would make it independently registered.
      if (entity.status === 'self_disclosed') {
        expect(entity.registration_reference, entry.provider_id).toBeNull();
      }
    }
  });

  it('never displays a person on weak evidence', () => {
    for (const entry of VERIFICATION_RECORDS) {
      if (entry.founder_operator.public_name === null) continue;
      expect(['strong', 'supported'], entry.provider_id).toContain(
        entry.founder_operator.strength,
      );
      // A named person needs at least one source about their role.
      const backing = entry.evidence.filter(
        (item) => item.claim_type === 'founder' || item.claim_type === 'operator',
      );
      expect(backing.length, `${entry.provider_id} operator evidence`).toBeGreaterThan(0);
    }
  });

  it('stamps every reviewed record with real calendar dates and substantiation', () => {
    for (const entry of VERIFICATION_RECORDS) {
      expect(entry.review_status, entry.provider_id).toBe('reviewed');
      expect(entry.last_reviewed_at, entry.provider_id).toMatch(ISO_DATE);
      // The shape alone would accept 2026-02-31, which the UI would print back
      // as "31 Feb 2026".
      expect(isCalendarDate(entry.last_reviewed_at), entry.provider_id).toBe(true);
      expect(entry.summary.length, entry.provider_id).toBeGreaterThan(40);
      expect(entry.unknowns.length, entry.provider_id).toBeGreaterThan(0);
      expect(entry.evidence.length, entry.provider_id).toBeGreaterThan(0);
      for (const item of entry.evidence) {
        expect(isCalendarDate(item.checked_at), `${entry.provider_id}: ${item.checked_at}`).toBe(
          true,
        );
        expect(item.note.length, entry.provider_id).toBeGreaterThan(10);
        expect(item.source_name.length, entry.provider_id).toBeGreaterThan(2);
      }
    }
  });

  it('rejects an impossible date rather than formatting it', () => {
    expect(isCalendarDate('2026-02-31')).toBe(false);
    expect(isCalendarDate('2025-02-29')).toBe(false);
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(reviewedLabel('2026-02-31')).toBe('2026-02-31');
    expect(reviewedLabel('2026-08-27')).toBe('27 Aug 2026');
  });

  it('only marks a channel established when its contents could be read', () => {
    const unreadable = record({
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
      unreadable_surfaces: ['terms', 'privacy'],
    });

    expect(publishedSurfaceCount(unreadable)).toBe(4);
    expect(presenceCount(unreadable)).toBe(2);

    const legal = transparencySignals(unreadable).find((signal) => signal.key === 'legal_pages');
    expect(legal?.state).toBe('partial');
    expect(legal?.detail).toContain('could not be read');
  });

  it('keeps the copy factual rather than a verdict about the provider', () => {
    // The layer reports what is public. It must never read as an accusation or
    // as a safety endorsement, in either direction.
    const forbidden =
      /\b(scam|scams|fraud|fraudulent|fake|stolen|illegal|untrustworthy|trustworthy|trusted|unsafe|dangerous|blacklist|suspicious|anonymous team|hiding)\b/i;

    for (const entry of VERIFICATION_RECORDS) {
      const copy = [entry.summary, ...entry.unknowns, ...entry.evidence.map((item) => item.note)];
      for (const text of copy) {
        expect(text, `${entry.provider_id}: ${text}`).not.toMatch(forbidden);
      }
    }
  });
});

describe('transparency derivation', () => {
  it('depends on nothing but the record fields the methodology names', () => {
    const inputs = {
      review_status: 'reviewed',
      legal_entity: {
        status: 'self_disclosed',
        name: 'Example Ltd',
        jurisdiction: null,
        registration_reference: null,
        strength: 'strong',
      },
      evidence: [evidence({ source_type: 'first_party', note: 'Terms name Example Ltd.' })],
      official_presence: presence('website', 'docs', 'terms'),
    } satisfies Partial<ProviderVerificationRecord>;

    const a = record({ ...inputs, provider_id: 'a', summary: 'One.', unknowns: ['x'] });
    const b = record({
      ...inputs,
      provider_id: 'b',
      summary: 'Something entirely different.',
      unknowns: ['y', 'z'],
      last_reviewed_at: '2020-01-01',
      operating_history: 'Irrelevant to the level.',
    });

    expect(deriveTransparencyLevel(a)).toBe(deriveTransparencyLevel(b));
    expect(deriveTransparencyLevel(a)).toBe('moderate');
  });

  it('treats a publicly identified operator as a full accountability anchor', () => {
    // The correction this pass exists for: a named person who publicly runs a
    // service is an anchor in their own right, with no company registration.
    const operatorLed = record({
      founder_operator: {
        status: 'identified',
        public_name: 'Ada Example',
        role: 'Operator',
        profile_urls: ['https://example.com/ada'],
        strength: 'strong',
      },
      evidence: [
        evidence({
          claim_type: 'operator',
          category: 'founder',
          source_type: 'profile',
          label: 'Ada Example',
          source_name: 'Personal profile',
          note: 'Ada Example states that she builds and runs the service.',
        }),
      ],
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
    });

    expect(founderStatus(operatorLed)).toBe('identified');
    expect(deriveTransparencyLevel(operatorLed)).toBe('high');
  });

  it('weakens an identified operator whose sources never name them', () => {
    const mismatched = record({
      founder_operator: {
        status: 'identified',
        public_name: 'Ada Example',
        role: 'Operator',
        profile_urls: [],
        strength: 'strong',
      },
      evidence: [
        evidence({
          claim_type: 'operator',
          category: 'founder',
          source_type: 'profile',
          label: 'Some account',
          source_name: 'A profile',
          note: 'An account posts about the service without naming who runs it.',
        }),
      ],
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
    });

    expect(founderStatus(mismatched)).toBe('likely');
    expect(deriveTransparencyLevel(mismatched)).toBe('moderate');
  });

  it('never displays an operator whose evidence is only a discovery lead', () => {
    const weak = record({
      founder_operator: {
        status: 'identified',
        public_name: 'Ada Example',
        role: 'Operator',
        profile_urls: [],
        strength: 'weak',
      },
      evidence: [
        evidence({
          claim_type: 'operator',
          category: 'founder',
          source_type: 'search_result',
          source_name: 'Search result',
          label: 'Ada Example',
          note: 'A single search snippet mentions Ada Example alongside the service.',
          strength: 'weak',
          opened: false,
        }),
      ],
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
    });

    expect(operatorIsDisplayable(weak)).toBe(false);
    expect(deriveTransparencyLevel(weak)).toBe('limited');
  });

  it('requires a registration reference before calling a company registered', () => {
    const noReference = record({
      legal_entity: {
        status: 'verified',
        name: 'Example Ltd',
        jurisdiction: 'England',
        registration_reference: null,
        strength: 'strong',
      },
      evidence: [evidence()],
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
    });

    expect(entityStatus(noReference)).toBe('self_disclosed');

    const withReference = record({
      legal_entity: {
        status: 'verified',
        name: 'Example Ltd',
        jurisdiction: 'England',
        registration_reference: 'https://registry.example.com/1',
        strength: 'strong',
      },
      evidence: [evidence()],
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
    });

    expect(entityStatus(withReference)).toBe('verified');
    expect(deriveTransparencyLevel(withReference)).toBe('high');
  });

  it('does not let a source corroborate a company it never names', () => {
    const mismatched = record({
      legal_entity: {
        status: 'verified',
        name: 'Example Ltd',
        jurisdiction: null,
        registration_reference: 'https://registry.example.com/1',
        strength: 'strong',
      },
      evidence: [
        evidence({
          source_type: 'third_party',
          label: 'Company profile',
          source_name: 'A directory',
          note: 'Profile describes a service with 11-50 people. No registered name is given.',
        }),
      ],
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
    });

    expect(entityStatus(mismatched)).toBe('self_disclosed');
  });

  it('does not let a social profile stand in for a registration record', () => {
    const profileOnly = record({
      legal_entity: {
        status: 'verified',
        name: 'Example Ltd',
        jurisdiction: null,
        registration_reference: 'https://social.example.com/exampleltd',
        strength: 'strong',
      },
      evidence: [
        evidence({
          source_type: 'profile',
          label: 'Example Ltd on a social platform',
          source_name: 'Social profile',
          note: 'Account for Example Ltd. Nothing about a companies register.',
        }),
      ],
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
    });

    expect(entityStatus(profileOnly)).toBe('self_disclosed');
  });

  it('reports limited when the service is public but nobody is identifiable', () => {
    const anonymous = record({
      official_presence: presence('website', 'docs', 'pricing', 'terms', 'privacy'),
    });

    expect(deriveTransparencyLevel(anonymous)).toBe('limited');
  });

  it('reports unverified when the record has not been reviewed', () => {
    const pending = record({
      review_status: 'not_reviewed',
      official_presence: presence('website', 'docs', 'terms', 'privacy'),
    });

    expect(deriveTransparencyLevel(pending)).toBe('unverified');
  });

  it('counts signals and channels from the record alone', () => {
    const entry = record({
      official_presence: presence('website', 'docs', 'terms', 'privacy', 'support'),
    });

    expect(presenceCount(entry)).toBe(5);

    const signals = transparencySignals(entry);
    // website, docs, legal pages, support — operator, company and accounts are
    // not established.
    expect(signalsFound(signals)).toBe(4);
    expect(signals).toHaveLength(7);
    expect(signals.find((signal) => signal.key === 'legal_pages')?.state).toBe('found');
    expect(signals.find((signal) => signal.key === 'founder_operator')?.state).toBe('missing');
  });

  it('marks a half-published legal pair as partial rather than found', () => {
    const half = record({ official_presence: presence('website', 'terms') });
    const legal = transparencySignals(half).find((signal) => signal.key === 'legal_pages');

    expect(legal?.state).toBe('partial');
    expect(legal?.detail).toContain('no privacy page');
  });

  it('accepts any one of the three account kinds for the account signal', () => {
    for (const key of ['x', 'linkedin', 'github'] as const) {
      const entry = record({ official_presence: presence(key) });
      const signal = transparencySignals(entry).find((item) => item.key === 'social');
      expect(signal?.state, key).toBe('found');
    }
  });
});

describe('verification rows and summary', () => {
  const rows = buildVerificationRows();

  it('builds one row per active provider', () => {
    expect(rows).toHaveLength(PROVIDERS.length);
    expect(new Set(rows.map((row) => row.provider_id)).size).toBe(PROVIDERS.length);
  });

  it('orders the strongest evidence first', () => {
    const order = ['high', 'moderate', 'limited', 'unverified'];
    const seen = rows.map((row) => order.indexOf(row.level));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('derives every summary count from the rows themselves', () => {
    const summary = summariseVerification(rows);

    expect(summary.total).toBe(rows.length);
    expect(summary.high + summary.moderate + summary.limited + summary.unverified).toBe(rows.length);
    expect(summary.needs_review).toBe(summary.limited + summary.unverified);
    expect(summary.public_operator).toBe(rows.filter((row) => row.operator_name !== null).length);
    expect(summary.named_company).toBe(rows.filter((row) => row.entity_name !== null).length);
    expect(summary.verified_entity).toBe(
      rows.filter((row) => row.entity_status === 'verified').length,
    );
  });

  it('counts a provider naming both a person and a company only once', () => {
    // `named_any` must not be the sum of the two counts, or the intro sentence
    // could claim more providers than exist.
    const both = summariseVerification([
      {
        ...rows[0]!,
        provider_id: 'both',
        operator_name: 'A Person',
        other_public_people: [],
        entity_name: 'Example Ltd',
      },
    ]);

    expect(both.public_operator).toBe(1);
    expect(both.named_company).toBe(1);
    expect(both.named_any).toBe(1);
  });

  it('never sends a name to the client that the evidence does not support', () => {
    for (const row of rows) {
      if (row.operator_name === null) {
        expect(row.profile_urls, row.provider_id).toHaveLength(0);
        expect(row.operator_role, row.provider_id).toBeNull();
      } else {
        expect(['strong', 'supported'], row.provider_id).toContain(row.operator_strength);
      }
    }
  });

  it('links the provider website rather than the referral destination as evidence', () => {
    for (const row of rows) {
      expect(row.website_url).toMatch(/^https:\/\//);
      expect(row.website_url).not.toContain('ref=');
      expect(row.website_url).not.toContain('aff=');
    }
  });

  it('matches each filter against the record field it claims to read', () => {
    const expected: Record<string, (row: (typeof rows)[number]) => boolean> = {
      all: () => true,
      operator: (row) => row.operator_name !== null || row.other_public_people.length > 0,
      company: (row) => row.entity_name !== null,
      registered: (row) => row.entity_status === 'verified',
      code: (row) => row.official_presence.github !== null,
      gap: (row) => row.level === 'limited' || row.level === 'unverified',
    };

    expect(VERIFICATION_FILTERS.map((entry) => entry.key).sort()).toEqual(
      Object.keys(expected).sort(),
    );

    for (const entry of VERIFICATION_FILTERS) {
      const check = expected[entry.key]!;
      expect(
        rows.filter(entry.test).map((row) => row.provider_id),
        entry.key,
      ).toEqual(rows.filter(check).map((row) => row.provider_id));
    }
  });
});

describe('verification UI', () => {
  const rows = buildVerificationRows();
  const summary = summariseVerification(rows);

  const html = renderToStaticMarkup(
    createElement(ProviderVerification, { rows, summary, query: '', onClearQuery: () => {} }),
  );

  it('renders the transparency table with every provider', () => {
    expect(html).toContain('Provider transparency');
    for (const row of rows) expect(html).toContain(row.name);
    expect(html).toContain('Founder / operator');
    expect(html).toContain('Official channels');
    expect(html).toContain('Last reviewed');
  });

  it('leads with what was found rather than with what could not be confirmed', () => {
    // The whole point of the correction pass: the top of the feature must not
    // be framed around providers failing to prove themselves.
    expect(html).toContain('Public identity and company information we found');
    expect(html).not.toMatch(/None of the \d+ providers/);
    expect(html).not.toMatch(/\d+ of \d+ independently confirmed/);
    expect(html).not.toMatch(/no public record of who operates/i);
  });

  it('shows summary cards built from the derived counts', () => {
    expect(html).toContain('High transparency');
    expect(html).toContain('Public founder or operator');
    expect(html).toContain('Named company or entity');
    expect(html).toContain('Needs further verification');
    expect(html).toContain(`/ ${summary.total}`);
  });

  it('offers the filter chips as real pressed-state buttons', () => {
    expect(html).toContain('aria-label="Filter providers by evidence"');
    expect(html).toContain('aria-pressed="true"');
    for (const entry of VERIFICATION_FILTERS) expect(html).toContain(entry.label);
  });

  it('explains the methodology without a separate documentation page', () => {
    expect(html).toContain('How these records are built');
    expect(html).toContain('not a company registration');
    expect(html).toContain('Missing information is shown as missing');
  });

  it('keeps the drawer closed until a provider is selected', () => {
    expect(html).not.toContain('role="dialog"');
  });

  it('renders a narrowed list when the shared search is applied', () => {
    const narrowed = renderToStaticMarkup(
      createElement(ProviderVerification, {
        rows,
        summary,
        query: 'relaygpu',
        onClearQuery: () => {},
      }),
    );

    expect(narrowed).toContain('RelayGPU');
    expect(narrowed).toContain('matching');
    expect(narrowed).not.toContain('>MidRelay<');
  });

  it('renders no rows and an escape hatch when the search matches nothing', () => {
    const empty = renderToStaticMarkup(
      createElement(ProviderVerification, {
        rows,
        summary,
        query: 'zzzzznotaprovider',
        onClearQuery: () => {},
      }),
    );

    expect(empty).toContain('No provider matches this view');
    expect(empty).toContain('Show all providers');
  });
});

describe('verification detail', () => {
  const rows = buildVerificationRows();

  it('shows signals, evidence links, unknowns and the caveat', () => {
    const row = rows.find((entry) => entry.evidence.length > 0);
    expect(row).toBeDefined();

    const html = renderToStaticMarkup(createElement(VerificationDetail, { row: row! }));

    expect(html).toContain('Transparency signals');
    expect(html).toContain(`${row!.signals_found} of ${row!.signal_total} found`);
    for (const item of row!.evidence) {
      expect(html).toContain(item.url);
      expect(html).toContain(item.label);
    }
    expect(html).toContain('What remains unknown');
    expect(html).toContain('does not guarantee service');
    expect(html).toContain('Last reviewed');
  });

  it('names a public operator and cites the source for the claim', () => {
    const row = rows.find((entry) => entry.operator_name !== null);
    expect(row, 'at least one provider should have a public operator').toBeDefined();

    const html = renderToStaticMarkup(createElement(VerificationDetail, { row: row! }));
    expect(html).toContain('Public people');
    expect(html).toContain(row!.operator_name!);
    if (row!.operator_role) expect(html).toContain(row!.operator_role);
  });

  it('says plainly when no operator was identified, without implying concealment', () => {
    const row = rows.find((entry) => entry.operator_name === null);
    expect(row).toBeDefined();

    const html = renderToStaticMarkup(createElement(VerificationDetail, { row: row! }));
    expect(html).toMatch(/not identified|could not establish/i);
    expect(html).not.toMatch(/anonymous|hiding|refuses/i);
  });

  it('labels provider-stated companies as unconfirmed', () => {
    const stated = rows.find((entry) => entry.entity_status === 'self_disclosed');
    if (!stated) return;

    const html = renderToStaticMarkup(createElement(VerificationDetail, { row: stated }));
    expect(html).toContain('Provider-stated entity');
    expect(html).toContain('could not confirm it against an independent registry');
  });

  it('renders only the official channels that actually exist', () => {
    const row = rows.find((entry) => entry.published_surface_count > 0)!;
    const html = renderToStaticMarkup(createElement(VerificationDetail, { row }));

    expect(html).toContain('Official channels');
    for (const [key, url] of Object.entries(row.official_presence)) {
      if (url === null) continue;
      expect(html, `${row.provider_id} ${key}`).toContain(url);
    }
  });

  it('opens evidence links safely in a new tab', () => {
    const row = rows.find((entry) => entry.evidence.length > 0)!;
    const html = renderToStaticMarkup(createElement(VerificationDetail, { row }));

    const links = html.match(/<a\b[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toContain('target="_blank"');
      expect(link).toContain('noopener');
    }
  });
});
