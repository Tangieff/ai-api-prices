import type { Adapter } from './types';
import { surplusIntelligenceAdapter } from './surplus-intelligence';
import { derouterAdapter } from './derouter';
import { clawhiveAdapter } from './clawhive';
import { worldgateAdapter } from './worldgate';
import { getgoapiAdapter } from './getgoapi';
import { boundlessAdapter } from './boundless';
import { llmsrelayAdapter } from './llmsrelay';

/**
 * Every provider adapter in the refresh set. New providers stay isolated in one
 * file and are registered here plus `lib/providers.ts`.
 */
export const ADAPTERS: Adapter[] = [
  surplusIntelligenceAdapter,
  derouterAdapter,
  clawhiveAdapter,
  worldgateAdapter,
  getgoapiAdapter,
  boundlessAdapter,
  llmsrelayAdapter,
];

export type { Adapter, RawOffer } from './types';
