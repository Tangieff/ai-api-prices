import { describe, expect, it } from 'vitest';
import { canonicalModelId, describeModel } from '@/lib/models';

describe('canonicalModelId', () => {
  it('folds the four providers’ spellings of one model onto one id', () => {
    // These are the real identifiers each source publishes for Claude Opus 4.5.
    const ids = [
      'claude-opus-4.5', // Surplus Intelligence
      'claude-opus-4-5-20251101', // GetGoAPI
      'Claude Opus 4.5', // derouter.ai
      'anthropic/claude-opus-4.5', // namespaced catalogues
      'anthropic.claude-opus-4-5', // Bedrock-style
    ].map((raw) => canonicalModelId(raw).id);

    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('claude-opus-4.5');
  });

  it('keeps release-date snapshots as tiers in both formats', () => {
    expect(canonicalModelId('claude-haiku-4-5-20251001')).toEqual({
      id: 'claude-haiku-4.5',
      tier: 'snapshot 2025-10-01',
    });
    expect(canonicalModelId('gpt-5.4-mini-2026-03-17')).toEqual({
      id: 'gpt-5.4-mini',
      tier: 'snapshot 2026-03-17',
    });
    expect(canonicalModelId('claude-haiku-4-5-20251001-thinking')).toEqual({
      id: 'claude-haiku-4.5',
      tier: 'snapshot 2025-10-01 · thinking',
    });
  });

  it('normalizes documented Qwen 3.5+ series spellings without merging Qwen 3 sizes', () => {
    expect(canonicalModelId('qwen/qwen3.6-35b-a3b').id).toBe('qwen3.6-35b-a3b');
    expect(canonicalModelId('qwen-3.6-35b-a3b').id).toBe('qwen3.6-35b-a3b');
    expect(canonicalModelId('qwen3-6-35b-a3b').id).toBe('qwen3.6-35b-a3b');
    expect(canonicalModelId('qwen3-8b').id).toBe('qwen3-8b');
  });

  it('strips vendor namespaces observed in the Wave 1 catalogues', () => {
    expect(canonicalModelId('deepseek/deepseek-v4-pro').id).toBe('deepseek-v4-pro');
    expect(canonicalModelId('cohere/command-a').id).toBe('command-a');
    expect(canonicalModelId('amazon/nova-lite-v1').id).toBe('nova-lite-v1');
    expect(canonicalModelId('aion-labs/aion-3.0').id).toBe('aion-3.0');
  });

  /**
   * The gateway catalogues rename two vendors: xAI ships under its parent
   * company and Z.ai under two different spellings. An unrecognised namespace
   * is not dropped but glued on — "spacexai/grok-4.6" would become
   * "spacexaigrok-4.6", a phantom model with no official baseline and so no
   * savings figure, which would also drop it out of the featured-model gate.
   */
  it('folds the gateway spellings of the xAI and Z.ai namespaces', () => {
    expect(canonicalModelId('spacexai/grok-4.6').id).toBe('grok-4.6');
    expect(canonicalModelId('xai/grok-4.6').id).toBe('grok-4.6');
    expect(canonicalModelId('zai/glm-5.2').id).toBe('glm-5.2');
    expect(canonicalModelId('zai-org/glm-5.3').id).toBe('glm-5.3');
    expect(canonicalModelId('z-ai/glm-5.3').id).toBe('glm-5.3');
  });

  /**
   * OhMyGPT qualifies the vendor with the upstream route it resells through.
   * The model is still GLM-5.2; the route is carried separately as a tier.
   */
  it('strips a vendor namespace qualified by an upstream route', () => {
    expect(canonicalModelId('alibaba:zhipu/glm-5.2').id).toBe('glm-5.2');
    expect(canonicalModelId('alibaba:deepseek/deepseek-v4-pro').id).toBe('deepseek-v4-pro');
    expect(canonicalModelId('fireworks/deepseek-v4-pro').id).toBe('deepseek-v4-pro');
    // The Bedrock-style dot separator must keep working.
    expect(canonicalModelId('anthropic.claude-opus-4-5').id).toBe('claude-opus-4.5');
  });

  it('keeps genuinely different models apart', () => {
    expect(canonicalModelId('claude-opus-4.5').id).not.toBe(canonicalModelId('claude-opus-4.6').id);
    // "-fast" is a separately priced routing variant, not a rendering of the base model.
    expect(canonicalModelId('claude-opus-4-8-fast').id).toBe('claude-opus-4.8-fast');
    expect(canonicalModelId('gpt-5.6-sol').id).not.toBe(canonicalModelId('gpt-5.6-terra').id);
  });

  it('peels reasoning-effort suffixes into a tier instead of a new model', () => {
    expect(canonicalModelId('claude-opus-4-7-thinking')).toEqual({
      id: 'claude-opus-4.7',
      tier: 'thinking',
    });
    expect(canonicalModelId('gemini-2.5-flash-nothinking')).toEqual({
      id: 'gemini-2.5-flash',
      tier: 'nothinking',
    });
    expect(canonicalModelId('grok-4-1-fast-non-reasoning').tier).toBe('non-reasoning');
  });

  it('keeps a thinking token budget attached to its tier', () => {
    expect(canonicalModelId('gemini-3.1-pro-preview-thinking-128')).toEqual({
      id: 'gemini-3.1-pro-preview',
      tier: 'thinking-128',
    });
    expect(canonicalModelId('gemini-3.1-pro-preview-thinking-high')).toEqual({
      id: 'gemini-3.1-pro-preview',
      tier: 'thinking-high',
    });
  });

  it('does not mistake a version number for a tier budget', () => {
    expect(canonicalModelId('gpt-5.4').tier).toBeNull();
    expect(canonicalModelId('deepseek-v4-pro-0813').tier).toBeNull();
  });

  it('always produces a usable id for unknown input', () => {
    expect(canonicalModelId('Some Brand New Model!').id).toBe('some-brand-new-model');
    expect(canonicalModelId('  spaced   name  ').id).toBe('spaced-name');
  });
});

describe('describeModel', () => {
  it('uses curated names and makers for known models', () => {
    const model = describeModel('claude-opus-5');
    expect(model.display_name).toBe('Claude Opus 5');
    expect(model.maker).toBe('Anthropic');
  });

  it('infers a maker for models that are not curated', () => {
    expect(describeModel('claude-opus-9.9').maker).toBe('Anthropic');
    expect(describeModel('gemini-9-ultra').maker).toBe('Google');
    expect(describeModel('nemotron-3-super-120b').maker).toBe('NVIDIA');
    expect(describeModel('nova-lite-v1').maker).toBe('Amazon');
    expect(describeModel('command-a').maker).toBe('Cohere');
    expect(describeModel('minimax-m3').maker).toBe('MiniMax');
    expect(describeModel('some-unknown-model').maker).toBeNull();
  });

  it('generates the short aliases people actually type', () => {
    const aliases = describeModel('claude-opus-5').aliases.join(' ').toLowerCase();
    expect(aliases).toContain('opus-5');
    expect(aliases).toContain('opus');
  });
});

describe('display names', () => {
  it('hyphenates GPT model numbers consistently, curated or derived', () => {
    // "GPT-5.6 Sol" is curated; "GPT-5.6 Sol Pro" is derived from the slug.
    // Both must read the same way or the list looks inconsistent.
    expect(describeModel('gpt-5.6-sol').display_name).toBe('GPT-5.6 Sol');
    expect(describeModel('gpt-5.6-sol-pro').display_name).toBe('GPT-5.6 Sol Pro');
    expect(describeModel('gpt-4o-realtime').display_name).toBe('GPT-4o Realtime');
  });

  it('leaves other vendors’ spacing alone', () => {
    expect(describeModel('kimi-k3').display_name).toBe('Kimi K3');
    expect(describeModel('glm-5.2').display_name).toBe('GLM 5.2');
    expect(describeModel('minimax-m2.7').display_name).toBe('MiniMax M2.7');
    expect(describeModel('claude-opus-9.9').display_name).toBe('Claude Opus 9.9');
    expect(describeModel('grok-9-turbo').display_name).toBe('Grok 9 Turbo');
  });
});
