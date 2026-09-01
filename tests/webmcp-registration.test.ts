import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerWebMcpTools } from '@/lib/webmcp/register';
import { buildWebMcpTools, type ShowInPageRequest } from '@/lib/webmcp/tools';
import { getModelContext } from '@/lib/webmcp/types';
import type { ModelContextTool, ModelContextRegisterToolOptions } from '@/lib/webmcp/types';
import { buildFixture } from './webmcp-fixture';

const data = buildFixture();

/**
 * A mock that follows the specification's registerTool algorithm closely enough
 * to catch the mistakes that matter:
 *
 *   - a duplicate name rejects with InvalidStateError rather than replacing;
 *   - an empty name or description rejects;
 *   - the input schema is stringified, so it must be plain JSON;
 *   - the returned promise resolves on a later task, leaving a real window in
 *     which an abort can both unregister the tool and reject that promise.
 *
 * This proves the shape of our registration code. It does not, and cannot,
 * prove that a real ChatGPT in-app browser executes these tools.
 */
class MockModelContext {
  readonly tools = new Map<string, ModelContextTool>();
  registerCalls = 0;

  registerTool(tool: ModelContextTool, options?: ModelContextRegisterToolOptions): Promise<void> {
    this.registerCalls += 1;

    if (this.tools.has(tool.name)) {
      return Promise.reject(new DOMException(`duplicate tool name: ${tool.name}`, 'InvalidStateError'));
    }
    if (!tool.name || !tool.description) {
      return Promise.reject(new DOMException('name and description are required', 'InvalidStateError'));
    }
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) {
      return Promise.reject(new DOMException(`illegal tool name: ${tool.name}`, 'InvalidStateError'));
    }
    try {
      JSON.stringify(tool.inputSchema);
    } catch {
      return Promise.reject(new TypeError('inputSchema must be JSON-serialisable'));
    }

    const signal = options?.signal;
    if (signal?.aborted) return Promise.reject(signal.reason);

    this.tools.set(tool.name, tool);

    return new Promise<void>((resolve, reject) => {
      signal?.addEventListener('abort', () => {
        this.tools.delete(tool.name);
        reject(signal.reason);
      });
      // Resolve off-thread like the real implementation, so an abort issued
      // before this settles still finds a pending promise to reject.
      queueMicrotask(resolve);
    });
  }
}

function installModelContext(modelContext: unknown): void {
  (globalThis as { document?: unknown }).document = { modelContext };
}

function clearDocument(): void {
  delete (globalThis as { document?: unknown }).document;
}

/** Let the mock's deferred resolutions and the registration loop settle. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

afterEach(() => {
  clearDocument();
});

describe('feature detection', () => {
  it('returns null in an unsupported environment', () => {
    // Node has no `document` at all — the same shape as an old browser.
    expect(getModelContext()).toBeNull();
  });

  it('returns null when the browser exposes no modelContext', () => {
    installModelContext(undefined);
    expect(getModelContext()).toBeNull();
  });

  it('returns null when modelContext exists but cannot register tools', () => {
    installModelContext({});
    expect(getModelContext()).toBeNull();
  });

  it('finds a usable model context', () => {
    installModelContext(new MockModelContext());
    expect(getModelContext()).not.toBeNull();
  });
});

describe('registerWebMcpTools', () => {
  it('does nothing and reports no error in a browser without WebMCP', async () => {
    const teardown = registerWebMcpTools(buildWebMcpTools({ data }));
    await settle();
    expect(() => teardown()).not.toThrow();
  });

  it('registers exactly the five tools', async () => {
    const modelContext = new MockModelContext();
    installModelContext(modelContext);

    registerWebMcpTools(buildWebMcpTools({ data }));
    await settle();

    expect([...modelContext.tools.keys()].sort()).toEqual([
      'compare_ai_model_providers',
      'compare_ai_models',
      'estimate_ai_workload_cost',
      'search_ai_model_prices',
      'show_ai_prices_in_page',
    ]);
  });

  it('unregisters everything on teardown', async () => {
    const modelContext = new MockModelContext();
    installModelContext(modelContext);

    const teardown = registerWebMcpTools(buildWebMcpTools({ data }));
    await settle();
    expect(modelContext.tools.size).toBe(5);

    teardown();
    expect(modelContext.tools.size).toBe(0);
  });

  it('survives a StrictMode-style mount, unmount, remount without a duplicate-name error', async () => {
    const modelContext = new MockModelContext();
    installModelContext(modelContext);

    const first = registerWebMcpTools(buildWebMcpTools({ data }));
    await settle();
    first();

    const second = registerWebMcpTools(buildWebMcpTools({ data }));
    await settle();

    expect(modelContext.tools.size).toBe(5);
    second();
    expect(modelContext.tools.size).toBe(0);
  });

  it('proves the duplicate guard is real: registering twice without teardown rejects', async () => {
    const modelContext = new MockModelContext();
    const [tool] = buildWebMcpTools({ data });
    if (!tool) throw new Error('expected a tool');

    await modelContext.registerTool(tool);
    await expect(modelContext.registerTool(tool)).rejects.toMatchObject({ name: 'InvalidStateError' });
  });

  it('swallows the abort rejection instead of leaking an unhandled rejection', async () => {
    const modelContext = new MockModelContext();
    installModelContext(modelContext);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    try {
      // Tear down immediately, while the first registerTool promise is pending.
      const teardown = registerWebMcpTools(buildWebMcpTools({ data }));
      teardown();
      await settle();
      expect(modelContext.tools.size).toBe(0);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('submits every tool independently, so one refusal cannot hide the rest', async () => {
    const modelContext = new MockModelContext();
    // Refuse the first tool outright, the way a user agent may for any one name.
    const original = modelContext.registerTool.bind(modelContext);
    let first = true;
    modelContext.registerTool = (tool, options) => {
      if (first) {
        first = false;
        modelContext.registerCalls += 1;
        return Promise.reject(new DOMException('refused', 'NotAllowedError'));
      }
      return original(tool, options);
    };
    installModelContext(modelContext);

    registerWebMcpTools(buildWebMcpTools({ data }));
    await settle();

    expect(modelContext.registerCalls).toBe(5);
    expect(modelContext.tools.size).toBe(4);
  });
});

describe('tool execution', () => {
  function toolNamed(name: string, showInPage?: (request: ShowInPageRequest) => void) {
    const tool = buildWebMcpTools({ data, showInPage }).find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  }

  it('returns JSON-serialisable results, because the user agent stringifies them', async () => {
    for (const tool of buildWebMcpTools({ data })) {
      const result = await tool.execute({
        model: 'Claude Opus 5',
        models: ['Claude Opus 5', 'GPT-5.6 Sol'],
        input_tokens: 1_000_000,
        output_tokens: 1_000_000,
      });
      expect(Array.isArray(result.content), tool.name).toBe(true);
      expect(result.content[0]?.type, tool.name).toBe('text');
      expect(typeof result.content[0]?.text, tool.name).toBe('string');
      // Compared against the original, not against another copy of itself:
      // this is what would catch a BigInt or a Map leaking into the payload.
      expect(JSON.parse(JSON.stringify(result)), tool.name).toEqual(result);
    }
  });

  it('never throws on hostile or missing arguments', async () => {
    const hostile: unknown[] = [
      undefined,
      null,
      'not an object',
      42,
      [],
      { models: null, input_tokens: 'lots' },
      { model: { toString: null } },
      JSON.parse('{"__proto__": {"polluted": true}}'),
    ];

    for (const tool of buildWebMcpTools({ data })) {
      for (const input of hostile) {
        const result = await tool.execute(input as Record<string, unknown>);
        expect(Array.isArray(result.content), `${tool.name} ${String(input)}`).toBe(true);
      }
    }

    // The prototype-pollution probe must not have taken effect.
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('drives the page through the supplied callback and clamps the query', async () => {
    const showInPage = vi.fn();
    const tool = toolNamed('show_ai_prices_in_page', showInPage);

    await tool.execute({ query: '  gpt 5.6 sol  ', view: 'providers' });
    expect(showInPage).toHaveBeenCalledWith({ query: 'gpt 5.6 sol', view: 'providers' });

    await tool.execute({ query: 'x'.repeat(500) });
    expect(showInPage).toHaveBeenLastCalledWith({ query: 'x'.repeat(100), view: 'models' });

    // An unknown view falls back to the default rather than being passed through.
    await tool.execute({ view: 'javascript:alert(1)' });
    expect(showInPage).toHaveBeenLastCalledWith({ query: '', view: 'models' });
  });

  it('resolves a named model to its canonical name so the right card is shown', async () => {
    const showInPage = vi.fn();
    const tool = toolNamed('show_ai_prices_in_page', showInPage);

    await tool.execute({ model: 'opus' });
    expect(showInPage).toHaveBeenCalledWith({ query: 'Claude Opus 5', view: 'models' });

    // An unresolvable model falls back to the supplied query rather than failing.
    await tool.execute({ model: 'not-a-model', query: 'deepseek' });
    expect(showInPage).toHaveBeenLastCalledWith({ query: 'deepseek', view: 'models' });
  });

  /**
   * Found by a production smoke test. The agent answered 'find GPT-5.6 Sol and
   * show me its cheapest providers', then handed off with the model name and
   * view: 'providers'. The Providers view is a directory that searches provider
   * NAMES, so the page ended up truthfully reporting that no provider is called
   * 'GPT-5.6 Sol' -- a dead end reached from a correct answer.
   */
  it('sends a resolved model to the models view even when providers was asked for', async () => {
    const showInPage = vi.fn();
    const tool = toolNamed('show_ai_prices_in_page', showInPage);

    const result = await tool.execute({ model: 'GPT-5.6 Sol', view: 'providers' });

    expect(showInPage).toHaveBeenCalledWith({ query: 'GPT-5.6 Sol', view: 'models' });
    expect(result.structuredContent).toMatchObject({
      applied: true,
      query: 'GPT-5.6 Sol',
      view: 'models',
    });
    // The prose the agent reads back must not claim a providers handoff either.
    expect(result.content[0]!.text).toContain('models view');
  });

  it('still opens the models view for a resolved model that asked for it', async () => {
    const showInPage = vi.fn();
    const tool = toolNamed('show_ai_prices_in_page', showInPage);

    await tool.execute({ model: 'opus', view: 'models' });
    expect(showInPage).toHaveBeenCalledWith({ query: 'Claude Opus 5', view: 'models' });
  });

  it('leaves the provider directory reachable for a provider search', async () => {
    const showInPage = vi.fn();
    const tool = toolNamed('show_ai_prices_in_page', showInPage);

    const result = await tool.execute({ query: 'Surplus Intelligence', view: 'providers' });

    expect(showInPage).toHaveBeenCalledWith({ query: 'Surplus Intelligence', view: 'providers' });
    expect(result.structuredContent).toMatchObject({ view: 'providers' });
  });

  it('does not hijack the view when the named model cannot be resolved', async () => {
    const showInPage = vi.fn();
    const tool = toolNamed('show_ai_prices_in_page', showInPage);

    // Nothing resolved, so the agent's own choice of view still stands.
    await tool.execute({ model: 'not-a-model', query: 'Surplus Intelligence', view: 'providers' });
    expect(showInPage).toHaveBeenCalledWith({ query: 'Surplus Intelligence', view: 'providers' });
  });
  it('honours an already-aborted execution signal', async () => {
    const showInPage = vi.fn();
    const controller = new AbortController();
    controller.abort();

    const result = await toolNamed('show_ai_prices_in_page', showInPage).execute(
      { query: 'opus' },
      { signal: controller.signal },
    );
    expect(result.isError).toBe(true);
    expect(showInPage).not.toHaveBeenCalled();
  });

  it('reports plainly when no page is wired up, rather than throwing', async () => {
    const result = await toolNamed('show_ai_prices_in_page').execute({ query: 'opus' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ applied: false });
  });

  it('answers the demo questions from the real tool surface', async () => {
    const providers = await toolNamed('compare_ai_model_providers').execute({ model: 'GPT-5.6 Sol' });
    expect(providers.content[0]?.text).toContain('Beta Gateway');

    const workload = await toolNamed('estimate_ai_workload_cost').execute({
      models: ['Claude Opus 5', 'GPT-5.6 Sol'],
      input_tokens: 50_000_000,
      output_tokens: 10_000_000,
    });
    expect(workload.content[0]?.text).toContain('Cheapest overall');
  });
});
