/**
 * Provider transparency records.
 *
 * This layer answers one question and no other: *what can the public establish
 * about who operates a provider?* It is deliberately not a safety rating, not a
 * quality score and not a model-authenticity check. Every field is either
 * evidence we actually retrieved or an explicit statement that we did not find
 * something.
 *
 * The records are a static typed source file, like `providers.ts` and
 * `official-prices.ts`. There is no database, no admin surface and no runtime
 * collection: a human researches a provider, records the sources, and stamps
 * `last_reviewed_at`.
 *
 * Three identity ideas are kept apart on purpose, because collapsing them is how
 * a transparency record turns into a trust claim:
 *
 *  1. A **public founder or operator** is an accountability signal. It needs a
 *     person publicly and credibly connected to the service — not a company
 *     registration. Someone who says "I built this" and is corroborated counts.
 *  2. A **provider-stated entity** is a company the provider names in its own
 *     Terms, Privacy or About. That is a claim.
 *  3. An **independently verified entity** needs a registry record or comparably
 *     strong independent corporate evidence. A LinkedIn company page is not one.
 */

/** How well a *company* claim is substantiated. */
export type EvidenceStatus =
  /** Independent registry record, or comparably strong independent evidence. */
  | 'verified'
  /** The provider states it on its own surfaces; nothing independent confirms it. */
  | 'self_disclosed'
  /** The listed public surfaces were checked and carried no such information. */
  | 'not_found'
  /** Surfaces were unreachable or ambiguous; the research is incomplete. */
  | 'unknown';

/**
 * How well a *person* claim is substantiated.
 *
 * Deliberately not `EvidenceStatus`: a public operator is not the sort of thing a
 * companies register answers, so borrowing the entity vocabulary would import a
 * proof standard that does not apply and would push every real operator down to
 * "self-disclosed".
 */
export type OperatorStatus =
  /** Publicly identified, with evidence that holds up. */
  | 'identified'
  /** Credibly indicated, but the evidence is thinner than we would like. */
  | 'likely'
  /** We searched the public record and found no one. */
  | 'not_found'
  /** Sources were unreachable or too ambiguous to conclude either way. */
  | 'unknown';

/**
 * How good the evidence behind a claim actually is.
 *
 *  - `strong` — a source we opened states it directly: the person's own profile,
 *    the provider's own material, a credible interview, a registry record.
 *  - `supported` — several independent public sources agree, or an official
 *    account and a personal profile reference each other, but no single source we
 *    could open states the claim outright.
 *  - `weak` — discovery only. A lone search snippet, a scraped mirror, an
 *    uncorroborated handle. Never the basis for anything the site displays.
 *  - `none` — no evidence, used where a claim is absent.
 */
export type EvidenceStrength = 'strong' | 'supported' | 'weak' | 'none';

/** Derived, never authored by hand. See `derive.ts` for the rules. */
export type TransparencyLevel = 'high' | 'moderate' | 'limited' | 'unverified';

export type ReviewStatus = 'reviewed' | 'not_reviewed';

/**
 * Where a piece of evidence came from. `first_party` is the provider's own
 * material: good proof that a page exists and says something, weak proof of who
 * is behind it. `search_result` means we could only ever read the search index's
 * rendering of a page, never the page itself.
 */
export type EvidenceSourceType =
  | 'first_party'
  | 'registry'
  | 'profile'
  | 'interview'
  | 'third_party'
  | 'search_result';

export type ClaimType = 'founder' | 'operator' | 'team' | 'entity' | 'presence' | 'history';

export type EvidenceCategory =
  | 'founder'
  | 'entity'
  | 'website'
  | 'docs'
  | 'pricing'
  | 'terms'
  | 'privacy'
  | 'github'
  | 'social'
  | 'support';

export interface EvidenceRef {
  category: EvidenceCategory;
  /** What this source is being used to establish. */
  claim_type: ClaimType;
  /** Short human label for the link, e.g. "Terms of Service". */
  label: string;
  /** What the source is, e.g. "Provider Terms", "LinkedIn profile", "GitHub org". */
  source_name: string;
  url: string;
  source_type: EvidenceSourceType;
  /** One factual sentence about what the source actually shows. No inference. */
  note: string;
  strength: EvidenceStrength;
  /** False when only the search index's rendering of the page could be read. */
  opened: boolean;
  /** UTC calendar date the source was last checked, `YYYY-MM-DD`. */
  checked_at: string;
}

export interface FounderOperator {
  status: OperatorStatus;
  /** Publicly self-published professional name or handle, or null. */
  public_name: string | null;
  /** Stated role, e.g. "Founder". Null when the role is not public. */
  role: string | null;
  /** Official public professional profiles, e.g. an X, LinkedIn or GitHub account. */
  profile_urls: string[];
  strength: EvidenceStrength;
}

/** A public team member who is not the founder or principal operator. */
export interface PublicPerson {
  name: string;
  role: string;
  url: string | null;
  strength: EvidenceStrength;
}

export interface LegalEntity {
  status: EvidenceStatus;
  name: string | null;
  jurisdiction: string | null;
  /** Company number or public registry record, when one exists and is linkable. */
  registration_reference: string | null;
  strength: EvidenceStrength;
}

/** The official surfaces a provider publishes. `null` means "we did not find one". */
export interface OfficialPresence {
  website: string | null;
  docs: string | null;
  pricing: string | null;
  terms: string | null;
  privacy: string | null;
  github: string | null;
  x: string | null;
  linkedin: string | null;
  /** Discord or Telegram, where that is a real published channel. */
  chat: string | null;
  support: string | null;
}

export const PRESENCE_KEYS = [
  'website',
  'docs',
  'pricing',
  'terms',
  'privacy',
  'github',
  'x',
  'linkedin',
  'chat',
  'support',
] as const satisfies readonly (keyof OfficialPresence)[];

export type PresenceKey = (typeof PRESENCE_KEYS)[number];

export interface ProviderVerificationRecord {
  /** Must match a `Provider.id` in `providers.ts`. */
  provider_id: string;
  review_status: ReviewStatus;
  /** UTC calendar date of the last human review, `YYYY-MM-DD`. */
  last_reviewed_at: string;
  founder_operator: FounderOperator;
  /** Named people who are not the principal operator. Usually empty. */
  other_public_people: PublicPerson[];
  legal_entity: LegalEntity;
  official_presence: OfficialPresence;
  /**
   * Surfaces that are served but whose text renders in the browser, so a fetch
   * returns only a shell. They stay in `official_presence` — the provider does
   * publish them — but they do not count as established, because nothing about
   * their contents was read.
   */
  unreadable_surfaces?: PresenceKey[];
  /** Public launch period or earliest public trace, where reliably established. */
  operating_history: string | null;
  evidence: EvidenceRef[];
  /** Two or three factual sentences. States what was found, not what it means. */
  summary: string;
  /** What we could not establish. Rendered verbatim under "What remains unknown". */
  unknowns: string[];
}
