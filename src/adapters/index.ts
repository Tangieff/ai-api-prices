import type { Adapter } from './types';
import { surplusIntelligenceAdapter } from './surplus-intelligence';
import { derouterAdapter } from './derouter';
import { worldgateAdapter } from './worldgate';
import { getgoapiAdapter } from './getgoapi';
import { boundlessAdapter } from './boundless';
import { llmsrelayAdapter } from './llmsrelay';
import { frugalRelayAdapter } from './frugal-relay';
import { cometapiAdapter } from './cometapi';
import { omniakeyAdapter } from './omniakey';
import { relayrouterAdapter } from './relayrouter';
import { aitransxAdapter } from './aitransx';
import { tokenmixAdapter } from './tokenmix';
import { relaygpuAdapter } from './relaygpu';

/**
 * Every provider adapter in the refresh set. New providers stay isolated in one
 * file and are registered here plus `lib/providers.ts`.
 */
export const ADAPTERS: Adapter[] = [
  surplusIntelligenceAdapter,
  derouterAdapter,
  worldgateAdapter,
  getgoapiAdapter,
  boundlessAdapter,
  llmsrelayAdapter,
  frugalRelayAdapter,
  cometapiAdapter,
  omniakeyAdapter,
  relayrouterAdapter,
  aitransxAdapter,
  tokenmixAdapter,
  relaygpuAdapter,
];

export type { Adapter, RawOffer } from './types';
