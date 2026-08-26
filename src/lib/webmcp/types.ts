/**
 * Minimal typings for the WebMCP browser API.
 *
 * WebMCP lets a page hand an AI agent a set of callable tools instead of making
 * it scrape the DOM. The API is new enough that it is not in TypeScript's DOM
 * lib yet, so the slice we actually use is declared here, transcribed from the
 * Web Machine Learning CG specification's IDL.
 *
 * Only the imperative registration surface is modelled. `getTools` and
 * `executeTool` exist for in-page agents and are declared optional because a
 * user agent that ships a partial implementation must not make feature
 * detection throw.
 */

/**
 * Hints the agent can use before calling a tool.
 *
 * `untrustedContentHint` matters here: every price in this product is scraped
 * from a third-party provider's public pricing page, so the text a tool returns
 * is not content we authored and should not be treated as instructions.
 */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface ToolExecuteCallbackOptions {
  signal: AbortSignal;
}

export interface ToolTextContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolTextContent[];
  /**
   * Compact machine-readable payload alongside the human-readable summary.
   *
   * Typed `unknown` rather than `JsonValue` because TypeScript will not assign a
   * plain interface to an index-signature type. The user agent runs the whole
   * result through `JSON.stringify`, so the real constraint is JSON-safety, and
   * that is asserted in the tests instead of the type system.
   */
  structuredContent?: unknown;
  isError?: boolean;
}

export interface ModelContextTool {
  /** 1-128 chars, ASCII alphanumerics plus `_`, `-` and `.` only. */
  name: string;
  title?: string;
  description: string;
  /** JSON Schema. Serialised by the user agent at registration, so plain data only. */
  inputSchema?: Record<string, unknown>;
  execute: (
    input: Record<string, unknown>,
    options?: ToolExecuteCallbackOptions,
  ) => Promise<ToolResult>;
  annotations?: ToolAnnotations;
}

export interface ModelContextRegisterToolOptions {
  exposedTo?: string[];
  /** Aborting unregisters the tool *and* rejects the original `registerTool` promise. */
  signal?: AbortSignal;
}

/**
 * Only the registration half of `ModelContext` is declared.
 *
 * `getTools` and `executeTool` exist on the real interface but are for in-page
 * agents calling tools; this page registers tools and never invokes them, so
 * declaring them would be describing an API we do not use.
 */
export interface ModelContext {
  registerTool(tool: ModelContextTool, options?: ModelContextRegisterToolOptions): Promise<void>;
}

export interface DocumentWithModelContext extends Document {
  modelContext?: ModelContext;
}

/**
 * Feature-detect WebMCP.
 *
 * Returns null rather than throwing in every unsupported case, because all of
 * them are normal: the API is `SecureContext`-only, so it is absent over plain
 * HTTP; it is absent entirely in browsers that have not shipped it; and it is
 * absent during server rendering, where there is no `document` at all. The
 * caller treats null as "this browser has no agent integration" and the page
 * behaves exactly as it always did.
 */
export function getModelContext(): ModelContext | null {
  try {
    if (typeof document === 'undefined') return null;
    const modelContext = (document as DocumentWithModelContext).modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') return null;
    return modelContext;
  } catch {
    return null;
  }
}
