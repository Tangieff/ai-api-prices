function sentenceCase(value: string): string {
  const spaced = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced ? `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}` : '';
}

function normalizeContext(value: string): string {
  return value
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/(\d+\s*[kKmM]?)\s*-\s*(\d+\s*[kKmM]?)/g, '$1–$2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turn provider-side tier strings into one deliberate, quiet public line. */
export function normalizeProviderMetadata(tier: string | null): string | null {
  if (!tier?.trim()) return null;
  const raw = tier.trim();

  if (/^\$[\d.]+\s*→\s*\$[\d.]+\s+(?:usage|credit)$/i.test(raw)) {
    return `Plan: ${raw.replace(/\s+usage$/i, ' usage credit')}`;
  }

  const eligibleRoute = /^(.+?)(?:\s+Route)?\s*·\s*eligibility varies$/i.exec(raw);
  if (eligibleRoute) {
    return `Route: ${sentenceCase(eligibleRoute[1] ?? '')} · eligibility varies`;
  }

  const routeParts = raw.split(/\s*·\s*/);
  const route = /^([^/]+)\s*\/\s*([^/]+)$/.exec(routeParts[0] ?? '');
  if (route) {
    const makerRaw = route[1] ?? '';
    const maker = sentenceCase(makerRaw);
    const channel = (route[2] ?? '').trim();
    const routeLabel =
      channel.toLowerCase() === 'auto'
        ? 'Automatic'
        : channel.toLowerCase() === makerRaw.trim().toLowerCase()
          ? `${maker} direct`
          : `${maker} via ${channel.toLowerCase() === 'openrouter' ? 'OpenRouter' : sentenceCase(channel)}`;
    const qualifiers = routeParts
      .slice(1)
      .map((part) => sentenceCase(part))
      .filter(Boolean)
      .join(' · ');
    return `Route: ${routeLabel}${qualifiers ? ` · ${qualifiers}` : ''}`;
  }

  const contextualMode =
    /^(no[_ -]?thinking|thinking)[_ -]((?:(?:<=|>=|<|>|≤|≥)?\d+[kKmM]|\d+[kKmM]?-\d+[kKmM]))(?:[_ ]output(<=|>=|<|>|≤|≥)(\d+))?$/i.exec(
      raw,
    );
  if (contextualMode) {
    const mode = sentenceCase(contextualMode[1] ?? '');
    const context = normalizeContext(contextualMode[2] ?? '');
    const output = contextualMode[3]
      ? ` · output ${normalizeContext(`${contextualMode[3]}${contextualMode[4] ?? ''}`)} tokens`
      : '';
    return `Mode: ${mode} · context ${context}${output}`;
  }

  if (
    /^(?:non[-_ ]?reasoning|reasoning|non[-_ ]?thinking|no[-_ ]?thinking|thinking(?:[-_ ].+)?)$/i.test(
      raw,
    )
  ) {
    return `Mode: ${normalizeContext(raw)}`;
  }

  const contextualTier =
    /^((?:(?:<=|>=|<|>|≤|≥)?\d+[kKmM]|\d+[kKmM]?-\d+[kKmM]))(?:[_ ]output(<=|>=|<|>|≤|≥)(\d+))?$/i.exec(
      raw,
    );
  if (contextualTier) {
    const output = contextualTier[2]
      ? ` · output ${normalizeContext(`${contextualTier[2]}${contextualTier[3] ?? ''}`)} tokens`
      : '';
    return `Context: ${normalizeContext(contextualTier[1] ?? '')}${output}`;
  }

  if (/^(?:short|long)[_ -]context$/i.test(raw)) {
    return `Context: ${normalizeContext(raw).replace(/ context$/i, '')}`;
  }

  if (
    /^(?:off[ _-]?peak|peak|standard|direct route|standard route|opengpu network|\d+% route)$/i.test(
      raw,
    )
  ) {
    return `Route: ${sentenceCase(raw.replace(/ route$/i, ''))}`;
  }

  return `Tier: ${normalizeContext(raw)}`;
}
