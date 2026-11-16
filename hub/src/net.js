// Network requests with a time limit: an answer that never comes must not hang the page.
// Shared by the hub pages (bundled into each by scripts/build.js) and the i360إ app (imported
// as '@i360/net'; its types come from the JSDoc below).

// The time limit when a caller names none: long enough for a slow phone network, short enough
// that a page doesn't seem stuck. Callers with their own reasons pass their own.
const DEFAULT_TIMEOUT_MS = 8000;

/** A pause, e.g. between two tries. @param {number} ms @returns {Promise<void>} */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// fetch(), aborted after `timeout` ms. The limit also covers `read` (reading the answer), when
// one is given; without one the Response is returned as soon as it arrives. A fetch that
// doesn't honour the abort (an old engine, a stand-in) still ends at the limit: an AbortError
// "timeout" follows one turn later, if the request hasn't ended by itself by then.
/**
 * @template [T=Response]
 * @param {string} url
 * @param {RequestInit & { timeout?: number, fetch?: typeof fetch }} [init]  fetch: another fetch to use (a
 *   test's stand-in, a Worker's own); the browser's by default
 * @param {(response: Response) => T | Promise<T>} [read]
 * @returns {Promise<T>}
 */
export async function fetchWithTimeout(url, { timeout = DEFAULT_TIMEOUT_MS, fetch: send = globalThis.fetch, ...options } = {}, read = (response) => /** @type {any} */ (response)) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer, backstop;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      backstop = setTimeout(() => { const e = new Error('timeout'); e.name = 'AbortError'; reject(e); }, 0);
    }, timeout);
  });
  const request = (async () => read(await send(url, { ...options, signal: controller ? controller.signal : undefined })))();
  request.catch(() => { /* settled after the limit: already answered by `expired` */ });
  try {
    return await Promise.race([request, expired]);
  } finally {
    clearTimeout(timer);
    clearTimeout(backstop);
  }
}

// JSON with a time limit and bounded retries: no retry on 4xx (except 429), otherwise up to
// `retries` more attempts, `backoff` ms apart and doubling. An HTTP error carries its .status.
/**
 * @param {string} url
 * @param {RequestInit & { timeout?: number, retries?: number, backoff?: number }} [init]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, { timeout = DEFAULT_TIMEOUT_MS, retries = 1, backoff = 800, ...options } = {}) {
  return retrying(() => fetchWithTimeout(url, { timeout, ...options }, (r) => {
    if (!r.ok) throw httpError(r.status);
    return r.json();
  }), { retries, backoff });
}

/** An error for an HTTP answer that wasn't OK, carrying its status (what retrying() decides by). @param {number} status */
export const httpError = (status) => Object.assign(new Error('HTTP ' + status), { status });

// Runs `attempt` again after a passing failure — a network error, no answer in time, or an error
// with a 5xx or 429 status — up to `retries` more times, waiting backoff, 2×backoff… in between.
// Any other 4xx is final. `attempt` is told whether this is the last try (to keep an answer
// rather than throw it). Shared by fetchJson and the CSE indexer.
/**
 * @template T
 * @param {(last: boolean) => Promise<T>} attempt
 * @param {{ retries?: number, backoff?: number }} [options]
 * @returns {Promise<T>}
 */
export async function retrying(attempt, { retries = 1, backoff = 800 } = {}) {
  for (let n = 0; ; n++) {
    try {
      return await attempt(n >= retries);
    } catch (e) {
      const status = /** @type {{ status?: number }} */ (e).status;
      const permanent = status && status >= 400 && status < 500 && status !== 429;
      if (permanent || n >= retries) throw e;
      await wait(backoff * 2 ** n);
    }
  }
}
