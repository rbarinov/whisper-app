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
 * Override the HTTP client used by processWithLLM(). For testing only.
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
    reasoning_effort: 'low', // G14 — MUST be present
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
