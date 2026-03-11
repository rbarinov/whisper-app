// Copyright (c) 2026 Roman Barinov. MIT License.

import { MAX_RETRIES, RETRY_DELAYS_MS } from '../../shared/constants';

export interface RetryOptions {
  maxRetries: number;
  delayMs: number[];
  shouldRetry?: (error: unknown, statusCode?: number) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: MAX_RETRIES,
  delayMs: [...RETRY_DELAYS_MS],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retry predicate: retry on network errors, 5xx, 408, 429.
 * No retry on other 4xx.
 */
export function defaultShouldRetry(_error: unknown, statusCode?: number): boolean {
  // Network errors (no status code) — always retry
  if (statusCode === undefined) return true;
  // 5xx — retry
  if (statusCode >= 500) return true;
  // 408 (timeout) and 429 (rate limit) — retry
  if (statusCode === 408 || statusCode === 429) return true;
  // Everything else (including other 4xx) — don't retry
  return false;
}

/**
 * Execute an async function with retry and backoff.
 * Throws the last error if all retries are exhausted.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts: RetryOptions = {
    maxRetries: options?.maxRetries ?? DEFAULT_OPTIONS.maxRetries,
    delayMs: options?.delayMs ?? DEFAULT_OPTIONS.delayMs,
    shouldRetry: options?.shouldRetry ?? defaultShouldRetry,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Extract statusCode from error if it has one
      const statusCode = extractStatusCode(err);

      if (!opts.shouldRetry!(err, statusCode)) {
        throw err;
      }

      lastError = err;

      // Wait before retrying (unless last attempt)
      if (attempt < opts.maxRetries - 1) {
        const delay = opts.delayMs[attempt] ?? opts.delayMs[opts.delayMs.length - 1];
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Extract a statusCode property from an error object, if present.
 */
function extractStatusCode(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    if (typeof code === 'number') return code;
  }
  return undefined;
}
