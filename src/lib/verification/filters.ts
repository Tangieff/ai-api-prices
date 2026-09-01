import type { VerificationRow } from './index';

/**
 * The filter chips above the transparency list.
 *
 * Deliberately a short, fixed set of evidence questions rather than a query
 * builder: each one answers "show me the providers where we could establish X",
 * and every predicate reads directly off a record field so the chip and the
 * table can never disagree.
 */
export interface VerificationFilter {
  key: VerificationFilterKey;
  label: string;
  test: (row: VerificationRow) => boolean;
}

/**
 * The chip keys, as a closed set. State typed against this union means an
 * unrecognised key is a compile error rather than a chip row that silently falls
 * back to All while the state stays invalid.
 */
export type VerificationFilterKey =
  | 'all'
  | 'operator'
  | 'company'
  | 'registered'
  | 'code'
  | 'gap';

export const ALL_FILTER: VerificationFilter = {
  key: 'all',
  label: 'All',
  test: () => true,
};

export const VERIFICATION_FILTERS: VerificationFilter[] = [
  ALL_FILTER,
  {
    key: 'operator',
    label: 'Public operator',
    test: (row) => row.operator_name !== null || row.other_public_people.length > 0,
  },
  {
    key: 'company',
    label: 'Named company',
    test: (row) => row.entity_name !== null,
  },
  {
    key: 'registered',
    label: 'Independently registered',
    test: (row) => row.entity_status === 'verified',
  },
  {
    key: 'code',
    label: 'Official code account',
    test: (row) => row.official_presence.github !== null,
  },
  {
    key: 'gap',
    label: 'Needs further verification',
    test: (row) => row.level === 'limited' || row.level === 'unverified',
  },
];
