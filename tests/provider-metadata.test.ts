import { describe, expect, it } from 'vitest';
import { normalizeProviderMetadata } from '@/lib/provider-metadata';

describe('provider metadata presentation', () => {
  it('labels routes, modes, plans and contexts instead of exposing raw tags', () => {
    expect(normalizeProviderMetadata('OpenAI / openrouter · batch · high')).toBe(
      'Route: OpenAI via OpenRouter · Batch · High',
    );
    expect(normalizeProviderMetadata('DeepSeek / deepseek')).toBe('Route: DeepSeek direct');
    expect(normalizeProviderMetadata('thinking-high')).toBe('Mode: thinking high');
    expect(normalizeProviderMetadata('thinking_<=128K')).toBe(
      'Mode: Thinking · context ≤128K',
    );
    expect(normalizeProviderMetadata('no_thinking_128K-256K')).toBe(
      'Mode: No thinking · context 128K–256K',
    );
    expect(normalizeProviderMetadata('128K-256K')).toBe('Context: 128K–256K');
    expect(normalizeProviderMetadata('0-32K_output<=200')).toBe(
      'Context: 0–32K · output ≤200 tokens',
    );
    expect(normalizeProviderMetadata('off peak')).toBe('Route: Off peak');
    expect(normalizeProviderMetadata('OpenGPU network')).toBe('Route: OpenGPU network');
  });

  it('keeps material prepaid and eligibility conditions readable on one line', () => {
    expect(normalizeProviderMetadata('$45 → $500 usage')).toBe(
      'Plan: $45 → $500 usage credit',
    );
    expect(normalizeProviderMetadata('$16 → $100 credit')).toBe('Plan: $16 → $100 credit');
    expect(normalizeProviderMetadata('Claude Route · eligibility varies')).toBe(
      'Route: Claude · eligibility varies',
    );
  });

  it('uses a labelled fallback and omits empty metadata', () => {
    expect(normalizeProviderMetadata('snapshot 2024-05-13')).toBe('Snapshot: 2024-05-13');
    expect(normalizeProviderMetadata('snapshot 2025-10-01 · thinking')).toBe(
      'Snapshot: 2025-10-01 · Mode: thinking',
    );
    expect(normalizeProviderMetadata('unclassified-special')).toBe('Tier: unclassified special');
    expect(normalizeProviderMetadata(null)).toBeNull();
    expect(normalizeProviderMetadata('')).toBeNull();
  });
});
