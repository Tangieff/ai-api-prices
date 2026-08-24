import { describe, expect, it } from 'vitest';
import { isComparableTextTokenModel } from '@/adapters/text-model';

describe('text-token product filtering', () => {
  it('keeps text and multimodal chat models', () => {
    expect(isComparableTextTokenModel('claude-opus-5')).toBe(true);
    expect(isComparableTextTokenModel('deepseek-v4-flash-vision-exp')).toBe(true);
    expect(isComparableTextTokenModel('gpt-4o')).toBe(true);
  });

  it('rejects non-comparable token-accounted products', () => {
    for (const id of [
      'gpt-image-2',
      'gemini-3.1-flash-image',
      'gpt-audio-1.5',
      'gpt-realtime-2.1',
      'gpt-4o-mini-transcribe',
      'tts-1',
      'whisper-1',
      'text-embedding-3-small',
      'omni-moderation-latest',
    ]) {
      expect(isComparableTextTokenModel(id), id).toBe(false);
    }
  });
});
