/** Products whose token accounting is not comparable to text generation. */
const NON_TEXT_PRODUCT =
  /(?:^|[-/.:])(?:image|video|audio|tts|embedding|whisper|sora|veo|realtime|transcribe|moderation)(?:[-/.:]|$)/i;

/**
 * Keep multimodal language models (for example a vision-capable chat model),
 * but reject media generation, speech, embedding and moderation products from
 * the USD-per-1M text-token comparison.
 */
export function isComparableTextTokenModel(id: string): boolean {
  return !NON_TEXT_PRODUCT.test(id);
}
