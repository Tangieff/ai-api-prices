import { describe, expect, it } from 'vitest';
import { WEBMCP_TOOL_NAMES, buildWebMcpTools } from '@/lib/webmcp/tools';
import { buildFixture } from './webmcp-fixture';

const data = buildFixture();
const tools = buildWebMcpTools({ data });


/** The spec's own constraint: 1-128 chars, ASCII alphanumerics plus `_`, `-`, `.`. */
const LEGAL_TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

describe('WebMCP tool definitions', () => {
  it('exposes exactly the five documented tools', () => {
    expect(tools).toHaveLength(5);
    expect(tools.map((tool) => tool.name)).toEqual([...WEBMCP_TOOL_NAMES]);
  });

  it('uses tool names the user agent will accept', () => {
    for (const tool of tools) {
      expect(tool.name, tool.name).toMatch(LEGAL_TOOL_NAME);
    }
  });

  it('gives every tool a title and a non-empty description', () => {
    // An empty description is rejected outright by registerTool.
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description.length, tool.name).toBeGreaterThan(40);
    }
  });

  it('states the price unit in every description that reports prices', () => {
    for (const tool of tools) {
      if (tool.name === 'show_ai_prices_in_page') continue;
      expect(tool.description, tool.name).toContain('1,000,000 tokens');
    }
  });

  it('declares closed object schemas that survive JSON serialisation', () => {
    for (const tool of tools) {
      const schema = tool.inputSchema;
      expect(schema, tool.name).toBeDefined();
      expect(schema?.type, tool.name).toBe('object');
      expect(schema?.additionalProperties, tool.name).toBe(false);
      // Registration stringifies the schema, so it must be plain JSON data.
      expect(JSON.parse(JSON.stringify(schema)), tool.name).toEqual(schema);
    }
  });

  it('marks the read-only tools read-only and the data untrusted', () => {
    // Provider prices are scraped third-party text, not content we authored.
    for (const tool of tools) {
      if (tool.name === 'show_ai_prices_in_page') {
        expect(tool.annotations?.readOnlyHint).toBe(false);
        continue;
      }
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.untrustedContentHint, tool.name).toBe(true);
    }
  });

  it('reads the newest prices through a getter without rebuilding the tools', async () => {
    // The page refreshes its data every five minutes. Tools built from a getter
    // must stay the same objects — otherwise every refresh unregisters and
    // re-registers all five at whatever agent is mid-conversation.
    let current = buildFixture();
    const built = buildWebMcpTools({ data: () => current });

    const before = await built[0]!.execute({ query: 'opus' });
    expect(before.content[0]?.text).toContain('Beta Gateway');

    const swapped = buildFixture();
    swapped.models = swapped.models.filter((model) => model.id !== 'claude-opus-5');
    current = swapped;

    const after = await built[0]!.execute({ query: 'opus' });
    expect(after.content[0]?.text).not.toContain('Beta Gateway');
  });

  it('reports the price snapshot date alongside every quote', () => {
    // A scraped price with no as-of date is a number an agent cannot vouch for.
    expect(buildFixture().generated_at).toBeTruthy();
  });

  it('gives every tool an executable callback', () => {
    for (const tool of tools) {
      expect(typeof tool.execute, tool.name).toBe('function');
    }
  });

  it('documents every declared property', () => {
    for (const tool of tools) {
      const properties = (tool.inputSchema?.properties ?? {}) as Record<string, { description?: string }>;
      expect(Object.keys(properties).length, tool.name).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(properties)) {
        expect(value.description, `${tool.name}.${key}`).toBeTruthy();
      }
    }
  });
});

/**
 * One provider can publish several rows for the same model — a long-context
 * tier alongside its base rate. The summary counted those rows against the
 * model's distinct provider count, so a model with tiered routes reported
 * more providers than it had: "11 of 9 providers".
 */
describe('compare_ai_model_providers summary counting', () => {
  function tieredData() {
    const base = buildFixture();
    const opus = base.models.find((model) => model.id === 'claude-opus-5');
    if (!opus) throw new Error('fixture is missing claude-opus-5');

    // Alpha publishes a second, long-context row. Two providers, three rows.
    const offers = [
      { ...opus.offers[0]!, provider_id: 'beta', tier: null },
      { ...opus.offers[1]!, provider_id: 'alpha', tier: null },
      { ...opus.offers[1]!, provider_id: 'alpha', tier: '>=200k', input_usd_per_1m: 10, output_usd_per_1m: 50 },
    ];
    const tiered = {
      ...opus,
      offers,
      provider_count: new Set(offers.map((offer) => offer.provider_id)).size,
    };
    return {
      ...base,
      models: base.models.map((model) => (model.id === 'claude-opus-5' ? tiered : model)),
    };
  }

  async function summaryFor(data: ReturnType<typeof tieredData>) {
    const [, compare] = buildWebMcpTools({ data });
    return (await compare!.execute({ model: 'claude-opus-5', limit: 25 }, undefined)) as {
      content: Array<{ text: string }>;
      structuredContent: { returned: number; provider_count: number };
    };
  }

  it('counts distinct providers on both sides of the ratio', async () => {
    const result = await summaryFor(tieredData());
    const summary = result.content[0]!.text;

    // Three rows across two providers: the ratio must not read "3 of 2".
    expect(result.structuredContent.returned).toBe(3);
    expect(result.structuredContent.provider_count).toBe(2);
    expect(summary).toContain('2 of 2 providers');
    expect(summary).not.toContain('3 of 2 providers');
  });

  it('names the extra rows instead of letting them look like a miscount', async () => {
    const summary = (await summaryFor(tieredData())).content[0]!.text;
    expect(summary).toContain('(3 priced routes)');
    // Every row is still listed; only the ratio changed.
    expect(summary.split('\n').filter((line) => /^\d+\. /.test(line))).toHaveLength(3);
  });

  it('says nothing about routes when each provider publishes one row', async () => {
    const summary = (await summaryFor(buildFixture() as never)).content[0]!.text;
    expect(summary).toContain('providers,');
    expect(summary).not.toContain('priced routes');
  });
});
