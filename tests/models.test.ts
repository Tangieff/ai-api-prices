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

  it('strips release-date stamps in both formats', () => {
    expect(canonicalModelId('claude-haiku-4-5-20251001').id).toBe('claude-haiku-4.5');
    expect(canonicalModelId('gpt-5.4-mini-2026-03-17').id).toBe('gpt-5.4-mini');
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
