// Copyright (c) 2026 Roman Barinov. MIT License.

import * as http from 'http';
import * as https from 'https';
import { LLM_TIMEOUT_MS } from '../../shared/constants';
import { retryWithBackoff } from './retry';

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_API_KEY'
      | 'INVALID_URL'
      | 'NETWORK_ERROR'
      | 'API_ERROR'
      | 'DECODING_ERROR',
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export interface LLMSettings {
  apiKey: string;
  apiBaseURL: string;
  llmModelName: string;
  llmSystemPrompt: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Called with each content token during streaming (this is the final text). */
  onToken?: (token: string) => void;
  /** Called with each reasoning/thinking token during streaming (ephemeral, not in final result). */
  onReasoning?: (token: string) => void;
}

/**
 * Minimal HTTP client interface for dependency injection (testability).
 */
export interface HttpClient {
  request(
    url: URL,
    options: http.RequestOptions,
    callback: (res: http.IncomingMessage) => void
  ): http.ClientRequest;
}

const defaultHttpClient: HttpClient = {
  request(url: URL, options: http.RequestOptions, callback: (res: http.IncomingMessage) => void) {
    const mod = url.protocol === 'https:' ? https : http;
    return mod.request(url, options, callback);
  },
};

let httpClient: HttpClient = defaultHttpClient;

/**
 * Override the HTTP client used by processWithLLM / processWithLLMStream().
 * For testing only.
 */
export function _setHttpClient(client: HttpClient | null): void {
  httpClient = client ?? defaultHttpClient;
}

/**
 * Process transcribed text through an LLM for post-processing.
 * Ported from Swift LLMService.
 */
export async function processWithLLM(
  text: string,
  settings: LLMSettings,
  options: RequestOptions = {}
): Promise<string> {
  if (!settings.apiKey || settings.apiKey.trim() === '') {
    throw new LLMError(
      'API key is not configured. Open Settings to set it.',
      'NO_API_KEY'
    );
  }

  const baseURL = settings.apiBaseURL.replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(`${baseURL}/v1/chat/completions`);
  } catch {
    throw new LLMError('Invalid API base URL. Check Settings.', 'INVALID_URL');
  }

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [];
  const systemPrompt = settings.llmSystemPrompt.trim();
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  // Wrap transcription in tags to clearly separate data from instructions
  messages.push({ role: 'user', content: `<transcription>${text}</transcription>` });

  const requestBody = JSON.stringify({
    model: settings.llmModelName,
    messages,
  });

  return retryWithBackoff(
    () => {
      if (options.signal?.aborted) {
        throw new LLMError('Request aborted', 'NETWORK_ERROR');
      }

      return doRequest(url, settings.apiKey, requestBody, options.signal);
    },
    {
      shouldRetry: (err) => {
        if (err instanceof LLMError) {
          // Non-retryable error codes
          if (
            err.code === 'NO_API_KEY' ||
            err.code === 'INVALID_URL' ||
            err.code === 'DECODING_ERROR'
          ) {
            return false;
          }
          // Non-retryable 4xx (except 408/429)
          if (
            err.code === 'API_ERROR' &&
            err.statusCode !== undefined &&
            err.statusCode >= 400 &&
            err.statusCode < 500 &&
            err.statusCode !== 408 &&
            err.statusCode !== 429
          ) {
            return false;
          }
        }
        return true;
      },
    }
  );
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

function doRequest(
  url: URL,
  apiKey: string,
  body: string,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError('Request aborted', 'NETWORK_ERROR'));
      return;
    }

    const options: http.RequestOptions = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: LLM_TIMEOUT_MS,
    };

    const req = httpClient.request(url, options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const data = Buffer.concat(chunks);
        const statusCode = res.statusCode ?? 0;

        if (statusCode === 200) {
          try {
            const parsed = JSON.parse(data.toString('utf-8')) as ChatCompletionResponse;
            const content = parsed.choices?.[0]?.message?.content;
            if (typeof content !== 'string') {
              reject(new LLMError('Failed to parse LLM response.', 'DECODING_ERROR'));
              return;
            }
            resolve(content.trim());
          } catch {
            reject(new LLMError('Failed to parse LLM response.', 'DECODING_ERROR'));
          }
          return;
        }

        const errorBody = data.toString('utf-8') || 'Unknown error';
        reject(
          new LLMError(
            `API error: HTTP ${statusCode}: ${errorBody}`,
            'API_ERROR',
            statusCode
          )
        );
      });

      res.on('error', (err) => {
        reject(new LLMError(`Network error: ${err.message}`, 'NETWORK_ERROR'));
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new LLMError('Request timed out', 'NETWORK_ERROR'));
    });

    req.on('error', (err) => {
      reject(new LLMError(`Network error: ${err.message}`, 'NETWORK_ERROR'));
    });

    const abortHandler = () => {
      req.destroy(new Error('Request aborted'));
      reject(new LLMError('Request aborted', 'NETWORK_ERROR'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    req.write(body);
    req.end();

    req.on('close', () => {
      signal?.removeEventListener('abort', abortHandler);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Streaming variant                                                  */
/* ------------------------------------------------------------------ */

interface SSEDelta {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
      reasoning?: string;
    };
    finish_reason?: string | null;
  }>;
}

/**
 * Process transcribed text through an LLM with streaming (SSE).
 * Calls `options.onToken` for each token as it arrives.
 * Returns the fully-accumulated text when the stream ends.
 */
export async function processWithLLMStream(
  text: string,
  settings: LLMSettings,
  options: RequestOptions = {},
): Promise<string> {
  if (!settings.apiKey || settings.apiKey.trim() === '') {
    throw new LLMError(
      'API key is not configured. Open Settings to set it.',
      'NO_API_KEY',
    );
  }

  const baseURL = settings.apiBaseURL.replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(`${baseURL}/v1/chat/completions`);
  } catch {
    throw new LLMError('Invalid API base URL. Check Settings.', 'INVALID_URL');
  }

  const messages: Array<{ role: string; content: string }> = [];
  const systemPrompt = settings.llmSystemPrompt.trim();
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: `<transcription>${text}</transcription>` });

  const requestBody = JSON.stringify({
    model: settings.llmModelName,
    messages,
    stream: true,
  });

  return retryWithBackoff(
    () => {
      if (options.signal?.aborted) {
        throw new LLMError('Request aborted', 'NETWORK_ERROR');
      }
      return doStreamRequest(url, settings.apiKey, requestBody, options.signal, options.onToken, options.onReasoning);
    },
    {
      shouldRetry: (err) => {
        if (err instanceof LLMError) {
          if (
            err.code === 'NO_API_KEY' ||
            err.code === 'INVALID_URL' ||
            err.code === 'DECODING_ERROR'
          ) {
            return false;
          }
          if (
            err.code === 'API_ERROR' &&
            err.statusCode !== undefined &&
            err.statusCode >= 400 &&
            err.statusCode < 500 &&
            err.statusCode !== 408 &&
            err.statusCode !== 429
          ) {
            return false;
          }
        }
        return true;
      },
    },
  );
}

function doStreamRequest(
  url: URL,
  apiKey: string,
  body: string,
  signal?: AbortSignal,
  onToken?: (token: string) => void,
  onReasoning?: (token: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError('Request aborted', 'NETWORK_ERROR'));
      return;
    }

    const reqOptions: http.RequestOptions = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: LLM_TIMEOUT_MS,
    };

    const req = httpClient.request(url, reqOptions, (res) => {
      const statusCode = res.statusCode ?? 0;

      // Non-200: buffer error body and reject
      if (statusCode !== 200) {
        const errorChunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => errorChunks.push(chunk));
        res.on('end', () => {
          const errorBody = Buffer.concat(errorChunks).toString('utf-8') || 'Unknown error';
          reject(new LLMError(`API error: HTTP ${statusCode}: ${errorBody}`, 'API_ERROR', statusCode));
        });
        res.on('error', (err) => {
          reject(new LLMError(`Network error: ${err.message}`, 'NETWORK_ERROR'));
        });
        return;
      }

      // 200: parse SSE stream
      let accumulated = '';
      let sseBuffer = '';

      res.on('data', (chunk: Buffer) => {
        sseBuffer += chunk.toString('utf-8');

        // Process complete SSE lines
        const lines = sseBuffer.split('\n');
        // Keep the last (possibly incomplete) line in the buffer
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // comment or blank
          if (trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6); // strip 'data: '
          try {
            const parsed = JSON.parse(jsonStr) as SSEDelta;
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // Reasoning/thinking tokens — ephemeral, shown in overlay but not in final result
            const reasoning = delta.reasoning_content ?? delta.reasoning ?? '';
            if (reasoning.length > 0) {
              onReasoning?.(reasoning);
            }

            // Content tokens — the actual output that gets pasted and saved
            const content = delta.content ?? '';
            if (content.length > 0) {
              accumulated += content;
              onToken?.(content);
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      });

      res.on('end', () => {
        if (accumulated.length === 0) {
          reject(new LLMError('Empty streaming response from LLM.', 'DECODING_ERROR'));
          return;
        }
        resolve(accumulated.trim());
      });

      res.on('error', (err) => {
        reject(new LLMError(`Network error: ${err.message}`, 'NETWORK_ERROR'));
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new LLMError('Request timed out', 'NETWORK_ERROR'));
    });

    req.on('error', (err) => {
      reject(new LLMError(`Network error: ${err.message}`, 'NETWORK_ERROR'));
    });

    const abortHandler = () => {
      req.destroy(new Error('Request aborted'));
      reject(new LLMError('Request aborted', 'NETWORK_ERROR'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    req.write(body);
    req.end();

    req.on('close', () => {
      signal?.removeEventListener('abort', abortHandler);
    });
  });
}
