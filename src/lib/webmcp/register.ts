import { getModelContext } from './types';
import type { ModelContextTool } from './types';

/**
 * Register a set of tools with the page's model context and return a teardown.
 *
 * Kept out of the React component so the lifecycle rules that actually matter
 * can be tested in node against a mock model context, rather than only being
 * asserted by reading the effect.
 *
 * The rules, all of them forced by the specification:
 *
 *   - Absent WebMCP, do nothing at all. The page is unchanged.
 *   - Every tool is submitted in the same tick rather than awaited in sequence.
 *     The spec adds a tool to the map synchronously and resolves its promise on
 *     a later task, so nothing here needs the previous promise to settle — and
 *     registering independently means one refused or slow registration cannot
 *     stop the remaining tools from appearing.
 *   - One `AbortController` owns every tool this call registers. Aborting it
 *     unregisters all of them, which is what makes a StrictMode double-mount or
 *     a Fast Refresh reload safe: the previous registration is gone before the
 *     next one starts, so no name collides with itself.
 *   - Every promise is caught. Abort rejects the original `registerTool`
 *     promise by design, so an uncaught one would turn every unmount into an
 *     unhandled rejection. A refusal (insecure context, permissions policy, a
 *     name already taken by something else) is swallowed for the same reason: a
 *     price comparison site must not break because a browser declined an
 *     optional integration.
 */
export function registerWebMcpTools(tools: ModelContextTool[]): () => void {
  const modelContext = getModelContext();
  if (!modelContext) return () => {};

  const controller = new AbortController();

  for (const tool of tools) {
    try {
      void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(
        () => {},
      );
    } catch {
      // A user agent that throws synchronously instead of rejecting.
    }
  }

  return () => controller.abort();
}
