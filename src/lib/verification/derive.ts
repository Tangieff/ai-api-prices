import type {
  EvidenceStatus,
  EvidenceStrength,
  OperatorStatus,
  PresenceKey,
  ProviderVerificationRecord,
  TransparencyLevel,
} from './types';
import { PRESENCE_KEYS } from './types';

/**
 * Deterministic transparency derivation.
 *
 * Nothing here is a judgement about a provider. The level is a plain function of
 * two inputs: whether an accountability anchor exists — a publicly identified
 * operator, or a company — and how many official channels we could actually
 * establish. The same record always produces the same level, and the reasons sit
 * next to the answer in the UI.
 */

/** Evidence that is good enough to display a claim to the public. */
const DISPLAYABLE = new Set<EvidenceStrength>(['strong', 'supported']);

/**
 * Only these can establish that a company is actually *registered*. A social or
 * code profile is independent of the provider but says nothing about a
 * companies register, so it cannot promote an entity to `verified`.
 */
const REGISTRATION_SOURCE_TYPES = new Set(['registry', 'third_party']);

/** Signals shown as rows in the detail drawer, in display order. */
export const TRANSPARENCY_SIGNALS = [
  { key: 'founder_operator', label: 'Public founder or operator' },
  { key: 'legal_entity', label: 'Company or legal entity' },
  { key: 'website', label: 'Official website' },
  { key: 'docs', label: 'Official documentation' },
  { key: 'social', label: 'Official social or code account' },
  { key: 'legal_pages', label: 'Terms and privacy pages' },
  { key: 'support', label: 'Support or contact route' },
] as const;

export type SignalKey = (typeof TRANSPARENCY_SIGNALS)[number]['key'];

export type SignalState = 'found' | 'partial' | 'missing';

export interface TransparencySignal {
  key: SignalKey;
  label: string;
  state: SignalState;
  /** Short factual phrase rendered next to the row. */
  detail: string;
}

/**
 * Does this source actually talk about the thing it is being used to
 * substantiate?
 *
 * Without this, any independent link filed under `entity` would promote any
 * company name in the same record. The check is deliberately blunt — the subject
 * has to appear in the source's own label, name or note — because the note is
 * written from the page that was opened, so a source that never mentions the
 * subject is a source that did not establish it.
 */
function mentionsSubject(
  record: ProviderVerificationRecord,
  subject: string,
  predicate: (item: ProviderVerificationRecord['evidence'][number]) => boolean,
): boolean {
  const needle = subject.trim().toLowerCase();
  return record.evidence.some((item) => {
    if (!predicate(item)) return false;
    return `${item.label} ${item.source_name} ${item.note}`.toLowerCase().includes(needle);
  });
}

/**
 * A public operator is an accountability signal, not a registration. It needs a
 * named person, evidence we would show a reader, and at least one source that
 * names that person while being about their role.
 */
function operatorIsSubstantiated(record: ProviderVerificationRecord): boolean {
  const name = record.founder_operator.public_name;
  if (!name) return false;
  if (!DISPLAYABLE.has(record.founder_operator.strength)) return false;
  return mentionsSubject(
    record,
    name,
    (item) =>
      (item.claim_type === 'founder' || item.claim_type === 'operator') &&
      DISPLAYABLE.has(item.strength),
  );
}

function entityIsCorroborated(record: ProviderVerificationRecord): boolean {
  const name = record.legal_entity.name;
  if (!name) return false;
  // A registration must be pointable-at. Without this, a self-authored company
  // profile filed under `entity` would be enough to render "Independently
  // registered", which is a claim about a companies register.
  if (record.legal_entity.registration_reference === null) return false;
  return mentionsSubject(
    record,
    name,
    (item) => item.claim_type === 'entity' && REGISTRATION_SOURCE_TYPES.has(item.source_type),
  );
}

function entityIsStated(record: ProviderVerificationRecord): boolean {
  const name = record.legal_entity.name;
  if (!name) return false;
  return record.evidence.some((item) => item.claim_type === 'entity');
}

/**
 * The layer fails closed in both directions: a claim can be weakened by the
 * evidence but never strengthened past it. An editing mistake in the record file
 * can lose a signal; it cannot manufacture one.
 */
export function founderStatus(record: ProviderVerificationRecord): OperatorStatus {
  const { status } = record.founder_operator;
  if (status === 'identified' && !operatorIsSubstantiated(record)) {
    return record.founder_operator.public_name ? 'likely' : 'unknown';
  }
  return status;
}

export function entityStatus(record: ProviderVerificationRecord): EvidenceStatus {
  const { status } = record.legal_entity;
  if (status === 'verified' && !entityIsCorroborated(record)) return 'self_disclosed';
  if (status === 'self_disclosed' && !entityIsStated(record)) return 'unknown';
  return status;
}

/** True when the operator claim is solid enough to render as an identity. */
export function operatorIsDisplayable(record: ProviderVerificationRecord): boolean {
  const status = founderStatus(record);
  return (
    (status === 'identified' || status === 'likely') &&
    record.founder_operator.public_name !== null &&
    DISPLAYABLE.has(record.founder_operator.strength)
  );
}

/**
 * A page that is served but renders its text in the browser is published, yet
 * nothing about its contents was established. Counting it as found would let a
 * provider's level rest on pages nobody read.
 */
function isUnreadable(record: ProviderVerificationRecord, key: PresenceKey): boolean {
  return record.unreadable_surfaces?.includes(key) ?? false;
}

function surfaceState(record: ProviderVerificationRecord, key: PresenceKey): SignalState {
  if (record.official_presence[key] === null) return 'missing';
  return isUnreadable(record, key) ? 'partial' : 'found';
}

/** Official channels whose contents we could actually establish. */
export function presenceCount(record: ProviderVerificationRecord): number {
  return PRESENCE_KEYS.filter((key) => surfaceState(record, key) === 'found').length;
}

/** Channels the provider serves, whether or not their contents could be read. */
export function publishedSurfaceCount(record: ProviderVerificationRecord): number {
  return PRESENCE_KEYS.filter((key) => record.official_presence[key] !== null).length;
}

export const PRESENCE_TOTAL = PRESENCE_KEYS.length;

const OPERATOR_DETAIL: Record<OperatorStatus, string> = {
  identified: 'Publicly identified',
  likely: 'Publicly indicated; evidence is incomplete',
  not_found: 'No operator named in the public record',
  unknown: 'Sources were unreachable or too ambiguous to say',
};

const ENTITY_DETAIL: Record<EvidenceStatus, string> = {
  // "Independently registered" states where a record was found. "Confirmed"
  // would read as a certificate this index is in no position to issue.
  verified: 'Independently registered',
  self_disclosed: 'Named by the provider; no independent record found',
  not_found: 'No company named on public surfaces',
  unknown: 'Sources were unreachable or ambiguous',
};

function operatorState(record: ProviderVerificationRecord): SignalState {
  const status = founderStatus(record);
  if (status === 'identified' && operatorIsDisplayable(record)) return 'found';
  if (status === 'likely' && operatorIsDisplayable(record)) return 'partial';
  return 'missing';
}

function entityState(status: EvidenceStatus): SignalState {
  if (status === 'verified') return 'found';
  if (status === 'self_disclosed') return 'partial';
  return 'missing';
}

function surfaceDetail(state: SignalState, published: string): string {
  if (state === 'found') return published;
  if (state === 'partial') return 'Served, but its content could not be read';
  return 'Not found';
}

/** Build the seven drawer rows. Pure function of the record. */
export function transparencySignals(record: ProviderVerificationRecord): TransparencySignal[] {
  const entity = entityStatus(record);

  const website = surfaceState(record, 'website');
  const docs = surfaceState(record, 'docs');
  const support = surfaceState(record, 'support');
  const terms = surfaceState(record, 'terms');
  const privacy = surfaceState(record, 'privacy');

  // Any one of the three account kinds satisfies the row; the strongest wins.
  const accountStates = (['x', 'linkedin', 'github'] as const).map((key) =>
    surfaceState(record, key),
  );
  const social: SignalState = accountStates.includes('found')
    ? 'found'
    : accountStates.includes('partial')
      ? 'partial'
      : 'missing';

  const legalStates = [terms, privacy];
  const legalPagesState: SignalState = legalStates.every((state) => state === 'found')
    ? 'found'
    : legalStates.some((state) => state !== 'missing')
      ? 'partial'
      : 'missing';

  const unreadableLegal = isUnreadable(record, 'terms') || isUnreadable(record, 'privacy');
  const legalPagesDetail =
    legalPagesState === 'found'
      ? 'Terms and privacy published'
      : legalPagesState === 'partial'
        ? unreadableLegal
          ? 'Served, but the text renders in the browser and could not be read'
          : terms !== 'missing'
            ? 'Terms published; no privacy page found'
            : 'Privacy published; no terms page found'
        : 'Neither page found';

  return [
    {
      key: 'founder_operator',
      label: 'Public founder or operator',
      state: operatorState(record),
      detail: OPERATOR_DETAIL[founderStatus(record)],
    },
    {
      key: 'legal_entity',
      label: 'Company or legal entity',
      state: entityState(entity),
      detail: ENTITY_DETAIL[entity],
    },
    {
      key: 'website',
      label: 'Official website',
      state: website,
      detail: surfaceDetail(website, 'Published'),
    },
    {
      key: 'docs',
      label: 'Official documentation',
      state: docs,
      detail: surfaceDetail(docs, 'Published'),
    },
    {
      key: 'social',
      label: 'Official social or code account',
      state: social,
      detail: social === 'missing' ? 'None found' : 'Published by the provider',
    },
    {
      key: 'legal_pages',
      label: 'Terms and privacy pages',
      state: legalPagesState,
      detail: legalPagesDetail,
    },
    {
      key: 'support',
      label: 'Support or contact route',
      state: support,
      detail: surfaceDetail(support, 'Published'),
    },
  ];
}

/** Signals in the `found` state. The UI reports this as "N of 7 found". */
export function signalsFound(signals: TransparencySignal[]): number {
  return signals.filter((signal) => signal.state === 'found').length;
}

export const SIGNAL_TOTAL = TRANSPARENCY_SIGNALS.length;

/**
 * The whole methodology, in one function.
 *
 * An accountability anchor is either a publicly identified operator *or* a
 * company. The two are alternatives on purpose: a named person who publicly runs
 * a service is real accountability information even where no company is
 * registered anywhere, and requiring a registry record for both would erase
 * every operator who is perfectly public about what they run.
 *
 *  - `high`       an anchor that independent sources substantiate — an operator
 *                 identified in the public record, or a registered company —
 *                 plus a substantial official presence.
 *  - `moderate`   an anchor that is public but thinner: an indicated operator, or
 *                 a company the provider names but nothing independent confirms.
 *  - `limited`    real public channels exist, but nobody could be established.
 *  - `unverified` not reviewed, or nothing at all was found.
 */
export function deriveTransparencyLevel(record: ProviderVerificationRecord): TransparencyLevel {
  if (record.review_status !== 'reviewed') return 'unverified';

  const operator = founderStatus(record);
  const entity = entityStatus(record);
  const surfaces = presenceCount(record);
  const displayable = operatorIsDisplayable(record);

  const strongAnchor =
    entity === 'verified' || (operator === 'identified' && displayable);
  const softAnchor =
    entity === 'self_disclosed' || (operator === 'likely' && displayable);

  if (strongAnchor && surfaces >= 4) return 'high';
  if ((strongAnchor || softAnchor) && surfaces >= 3) return 'moderate';
  if (surfaces >= 1) return 'limited';
  return 'unverified';
}

export const TRANSPARENCY_LEVEL_LABEL: Record<TransparencyLevel, string> = {
  high: 'High transparency',
  moderate: 'Moderate transparency',
  limited: 'Limited transparency',
  unverified: 'Unverified',
};

/**
 * One line explaining what a level means.
 *
 * Each sentence has to be true of *every* record that reaches that level, not
 * just the common case, and each describes what this record contains rather than
 * what the provider is like. "We could not establish X" is a statement about our
 * evidence; "they are not transparent" would be a judgement, and is not ours to
 * make.
 */
export const TRANSPARENCY_LEVEL_BLURB: Record<TransparencyLevel, string> = {
  high: 'A person who publicly operates the service, or a registered company, is substantiated by sources independent of the provider, and the provider publishes a substantial official presence.',
  moderate:
    'An operator or company is identifiable from public material, but this record does not reach high transparency — either the identity rests on thinner evidence, or the official presence behind it is narrower. The signals below show which.',
  limited:
    'The service publishes real official channels, but we could not establish who operates it. That is a gap in the public record, not a claim that anyone is concealing anything.',
  unverified: 'We have not collected enough public information to say who operates this provider.',
};
