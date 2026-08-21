/**
 * Minimal fetch wrapper for provider adapters.
 *
 * Adapters talk to third-party sites that can hang, redirect or return HTML
 * where JSON was promised. Every request therefore has a hard timeout and a
 * descriptive error, so one slow provider cannot stall the whole refresh.
 */

const DEFAULT_TIMEOUT_MS = 20_000;

const USER_AGENT =
  'OXWebPrices/0.1 (+https://prices.oxweb.xyz; public price comparison; contact via repository)';

export interface FetchOptions {
  timeoutMs?: number;
  accept?: string;
}

async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': USER_AGENT,
        accept: options.accept ?? '*/*',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timed out after ${timeoutMs}ms fetching ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const response = await fetchWithTimeout(url, {
    accept: 'text/html,application/xhtml+xml',
    ...options,
  });
  return response.text();
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetchWithTimeout(url, { accept: 'application/json', ...options });
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Expected JSON from ${url}, got ${body.slice(0, 120)}…`);
  }
}
