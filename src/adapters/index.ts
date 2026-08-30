import type { Adapter } from './types';
import { PROVIDERS } from '@/lib/providers';
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
import { relayAiAdapter } from './relay-ai';
import { llmrelayDevAdapter } from './llmrelay-dev';
import { midrelayAdapter } from './midrelay';
import { zrelayAdapter } from './zrelay';
import { relayFastAdapter } from './relay-fast';

/** Every implemented adapter, including providers retained as inactive history. */
const ALL_ADAPTERS: Adapter[] = [
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
  relayAiAdapter,
  llmrelayDevAdapter,
  midrelayAdapter,
  zrelayAdapter,
  relayFastAdapter,
];

const ADAPTERS_BY_PROVIDER_ID = new Map(
  ALL_ADAPTERS.map((adapter) => [adapter.provider_id, adapter]),
);

/**
 * The canonical provider registry controls the live refresh set. Keeping an
 * adapter implemented does not activate its provider or let its rows enter the
 * generated dataset.
 */
export const ADAPTERS: Adapter[] = PROVIDERS.map((provider) => {
  const adapter = ADAPTERS_BY_PROVIDER_ID.get(provider.id);
  if (!adapter) throw new Error(`No adapter registered for active provider ${provider.id}`);
  return adapter;
});

export type { Adapter, RawOffer } from './types';
