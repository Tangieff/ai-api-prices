import { PROVIDERS } from '../providers';
import { buildSearchText } from '../search';
import type { Provider } from '../types';
import {
  PRESENCE_TOTAL,
  SIGNAL_TOTAL,
  TRANSPARENCY_LEVEL_BLURB,
  TRANSPARENCY_LEVEL_LABEL,
  deriveTransparencyLevel,
  entityStatus,
  founderStatus,
  operatorIsDisplayable,
  presenceCount,
  publishedSurfaceCount,
  signalsFound,
  transparencySignals,
  type TransparencySignal,
} from './derive';
import { VERIFICATION_RECORDS, VERIFICATION_RECORDS_BY_PROVIDER, indexRecords } from './records';
import type {
  EvidenceRef,
  EvidenceStatus,
  EvidenceStrength,
  OfficialPresence,
  OperatorStatus,
  ProviderVerificationRecord,
  PublicPerson,
  TransparencyLevel,
} from './types';

export * from './types';
export * from './derive';
export { VERIFICATION_RECORDS, VERIFICATION_RECORDS_BY_PROVIDER, indexRecords };

/** One provider, shaped for rendering. */
export interface VerificationRow {
  provider_id: string;
  name: string;
  /** First-party site, never a referral link — this is the evidence surface. */
  website_url: string;
  level: TransparencyLevel;
  level_label: string;
  level_blurb: string;
  operator_status: OperatorStatus;
  /** Null unless the evidence is good enough to put a name on screen. */
  operator_name: string | null;
  operator_role: string | null;
  operator_strength: EvidenceStrength;
  profile_urls: string[];
  other_public_people: PublicPerson[];
  entity_status: EvidenceStatus;
  entity_name: string | null;
  entity_jurisdiction: string | null;
  registration_reference: string | null;
  official_presence: OfficialPresence;
  /** Channels whose contents were established. Feeds the level. */
  presence_count: number;
  /** Channels the provider serves, readable or not. What the table column shows. */
  published_surface_count: number;
  presence_total: number;
  operating_history: string | null;
  signals: TransparencySignal[];
  signals_found: number;
  signal_total: number;
  evidence: EvidenceRef[];
  unknowns: string[];
  summary: string;
  last_reviewed_at: string;
  reviewed: boolean;
  search_text: string;
}

/** Counts for the summary cards. Always derived, never written by hand. */
export interface VerificationSummary {
  total: number;
  high: number;
  moderate: number;
  limited: number;
  unverified: number;
  /** A person is named as founder or operator, with displayable evidence. */
  public_operator: number;
  /** Any named person at all, operator or other public team member. */
  any_public_person: number;
  /** A company name appears in the record. */
  named_company: number;
  /** A company backed by an independent registration record. */
  verified_entity: number;
  /** Providers with a named person *or* a named company, counted once each. */
  named_any: number;
  /** Limited plus unverified: where more research would change the picture. */
  needs_review: number;
}

/**
 * A provider that is active but has no record yet. It renders honestly as
 * `unverified` rather than disappearing from the list, so adding a provider
 * without researching it is visible instead of silent.
 */
function placeholderRecord(providerId: string): ProviderVerificationRecord {
  return {
    provider_id: providerId,
    review_status: 'not_reviewed',
    last_reviewed_at: '',
    founder_operator: {
      status: 'unknown',
      public_name: null,
      role: null,
      profile_urls: [],
      strength: 'none',
    },
    other_public_people: [],
    legal_entity: {
      status: 'unknown',
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
    summary: 'This provider has not been reviewed yet.',
    unknowns: ['No transparency review has been carried out for this provider.'],
  };
}

function toRow(provider: Provider, record: ProviderVerificationRecord): VerificationRow {
  const level = deriveTransparencyLevel(record);
  // Built once and reused: the count is derived from this array rather than
  // rebuilding it, so the rows and the tally can never disagree.
  const signals = transparencySignals(record);
  // A name only reaches the screen when the evidence behind it would survive
  // being clicked on.
  const displayable = operatorIsDisplayable(record);

  return {
    provider_id: record.provider_id,
    name: provider.name,
    website_url: provider.website_url,
    level,
    level_label: TRANSPARENCY_LEVEL_LABEL[level],
    level_blurb: TRANSPARENCY_LEVEL_BLURB[level],
    operator_status: founderStatus(record),
    operator_name: displayable ? record.founder_operator.public_name : null,
    operator_role: displayable ? record.founder_operator.role : null,
    operator_strength: record.founder_operator.strength,
    profile_urls: displayable ? record.founder_operator.profile_urls : [],
    other_public_people: record.other_public_people,
    entity_status: entityStatus(record),
    entity_name: record.legal_entity.name,
    entity_jurisdiction: record.legal_entity.jurisdiction,
    registration_reference: record.legal_entity.registration_reference,
    official_presence: record.official_presence,
    presence_count: presenceCount(record),
    published_surface_count: publishedSurfaceCount(record),
    presence_total: PRESENCE_TOTAL,
    operating_history: record.operating_history,
    signals,
    signals_found: signalsFound(signals),
    signal_total: SIGNAL_TOTAL,
    evidence: record.evidence,
    unknowns: record.unknowns,
    summary: record.summary,
    last_reviewed_at: record.last_reviewed_at,
    reviewed: record.review_status === 'reviewed',
    search_text: buildSearchText([
      provider.name,
      provider.id,
      record.legal_entity.name,
      displayable ? record.founder_operator.public_name : null,
      ...record.other_public_people.map((person) => person.name),
      TRANSPARENCY_LEVEL_LABEL[level],
    ]),
  };
}

const LEVEL_ORDER: Record<TransparencyLevel, number> = {
  high: 0,
  moderate: 1,
  limited: 2,
  unverified: 3,
};

/**
 * Every active provider gets exactly one row, ordered strongest-evidence first
 * so the list reads as an index rather than a leaderboard of the same providers
 * the pricing table already ranks.
 */
export function buildVerificationRows(): VerificationRow[] {
  const rows = PROVIDERS.map((provider) =>
    toRow(
      provider,
      VERIFICATION_RECORDS_BY_PROVIDER.get(provider.id) ?? placeholderRecord(provider.id),
    ),
  );

  return rows.sort(
    (a, b) =>
      LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
      b.signals_found - a.signals_found ||
      a.name.localeCompare(b.name),
  );
}

export function summariseVerification(rows: VerificationRow[]): VerificationSummary {
  const count = (predicate: (row: VerificationRow) => boolean) => rows.filter(predicate).length;
  const hasPerson = (row: VerificationRow) =>
    row.operator_name !== null || row.other_public_people.length > 0;

  return {
    total: rows.length,
    high: count((row) => row.level === 'high'),
    moderate: count((row) => row.level === 'moderate'),
    limited: count((row) => row.level === 'limited'),
    unverified: count((row) => row.level === 'unverified'),
    public_operator: count((row) => row.operator_name !== null),
    any_public_person: count(hasPerson),
    named_company: count((row) => row.entity_name !== null),
    verified_entity: count((row) => row.entity_status === 'verified'),
    named_any: count((row) => hasPerson(row) || row.entity_name !== null),
    needs_review: count((row) => row.level === 'limited' || row.level === 'unverified'),
  };
}
