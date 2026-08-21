import type { Adapter } from './types';
import { surplusIntelligenceAdapter } from './surplus-intelligence';
import { derouterAdapter } from './derouter';
import { clawhiveAdapter } from './clawhive';
import { worldgateAdapter } from './worldgate';
import { getgoapiAdapter } from './getgoapi';

/**
 * Every adapter in the launch set. Adding provider #6 means writing one file and
 * appending it here plus an entry in `lib/providers.ts` — nothing else.
 */
export const ADAPTERS: Adapter[] = [
  surplusIntelligenceAdapter,
  derouterAdapter,
  clawhiveAdapter,
  worldgateAdapter,
  getgoapiAdapter,
];

export type { Adapter, RawOffer } from './types';
