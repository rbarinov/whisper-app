// Copyright (c) 2026 Roman Barinov. MIT License.

import * as fs from 'fs';
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { MAX_RETRIES, RETRY_DELAYS_MS, WHISPER_TIMEOUT_MS } from '../../shared/constants';

export interface TranscriptionResult {
  text: string;
}

export class TranscriptionError extends Error {
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
    this.name = 'TranscriptionError';
  }
}

export interface TranscriptionSettings {
  apiKey: string;
  apiBaseURL: string;
  modelName: string;
  language: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * Minimal HTTP client interface for dependency injection (testability).
 * The `request` function mirrors Node's http.request / https.request signature.
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
 * Override the HTTP client used by transcribe(). For testing only.
 */
export function _setHttpClient(client: HttpClient | null): void {
  httpClient = client ?? defaultHttpClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMultipartBody(
  boundary: string,
  settings: TranscriptionSettings,
  audioData: Buffer
): Buffer {
  const parts: Buffer[] = [];

  // model field
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from('Content-Disposition: form-data; name="model"\r\n\r\n'));
  parts.push(Buffer.from(`${settings.modelName}\r\n`));

  // response_format field
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from('Content-Disposition: form-data; name="response_format"\r\n\r\n'));
  parts.push(Buffer.from('json\r\n'));

  // language field (only if non-empty)
  const lang = settings.language.trim();
  if (lang) {
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from('Content-Disposition: form-data; name="language"\r\n\r\n'));
    parts.push(Buffer.from(`${lang}\r\n`));
  }

  // file field
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(
    Buffer.from('Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n')
  );
  parts.push(Buffer.from('Content-Type: audio/wav\r\n\r\n'));
  parts.push(audioData);
  parts.push(Buffer.from('\r\n'));

  // closing boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return Buffer.concat(parts);
}

export async function transcribe(
  audioInput: string | Buffer,
  settings: TranscriptionSettings,
  options: RequestOptions = {}
): Promise<string> {
  if (!settings.apiKey || settings.apiKey.trim() === '') {
    throw new TranscriptionError(
      'API key is not configured. Open Settings to set it.',
      'NO_API_KEY'
    );
  }

  const baseURL = settings.apiBaseURL.replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(`${baseURL}/audio/transcriptions`);
  } catch {
    throw new TranscriptionError('Invalid API base URL. Check Settings.', 'INVALID_URL');
  }

  const audioData = typeof audioInput === 'string' ? fs.readFileSync(audioInput) : audioInput;
  const boundary = `Boundary-${crypto.randomUUID()}`;
  const body = buildMultipartBody(boundary, settings, audioData);

  let lastError: Error = new TranscriptionError('Unknown error', 'NETWORK_ERROR');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (options.signal?.aborted) {
      throw new TranscriptionError('Request aborted', 'NETWORK_ERROR');
    }

    try {
      const result = await doRequest(url, boundary, settings.apiKey, body, options.signal);
      return result;
    } catch (err) {
      if (err instanceof TranscriptionError) {
        // Non-retryable errors: throw immediately
        if (
          err.code === 'NO_API_KEY' ||
          err.code === 'INVALID_URL' ||
          err.code === 'DECODING_ERROR'
        ) {
          throw err;
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
          throw err;
        }
        lastError = err;
      } else {
        lastError = new TranscriptionError(
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
          'NETWORK_ERROR'
        );
      }
    }

    // Wait before retrying (unless last attempt)
    if (attempt < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

function doRequest(
  url: URL,
  boundary: string,
  apiKey: string,
  body: Buffer,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new TranscriptionError('Request aborted', 'NETWORK_ERROR'));
      return;
    }

    const options: http.RequestOptions = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: WHISPER_TIMEOUT_MS,
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
            const parsed = JSON.parse(data.toString('utf-8')) as TranscriptionResult;
            if (typeof parsed.text !== 'string') {
              reject(
                new TranscriptionError('Failed to parse API response.', 'DECODING_ERROR')
              );
              return;
            }
            resolve(parsed.text);
          } catch {
            reject(
              new TranscriptionError('Failed to parse API response.', 'DECODING_ERROR')
            );
          }
          return;
        }

        const errorBody = data.toString('utf-8') || 'Unknown error';
        reject(
          new TranscriptionError(
            `API error: HTTP ${statusCode}: ${errorBody}`,
            'API_ERROR',
            statusCode
          )
        );
      });

      res.on('error', (err) => {
        reject(new TranscriptionError(`Network error: ${err.message}`, 'NETWORK_ERROR'));
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new TranscriptionError('Request timed out', 'NETWORK_ERROR'));
    });

    req.on('error', (err) => {
      reject(new TranscriptionError(`Network error: ${err.message}`, 'NETWORK_ERROR'));
    });

    const abortHandler = () => {
      req.destroy(new Error('Request aborted'));
      reject(new TranscriptionError('Request aborted', 'NETWORK_ERROR'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    req.write(body);
    req.end();

    req.on('close', () => {
      signal?.removeEventListener('abort', abortHandler);
    });
  });
}
