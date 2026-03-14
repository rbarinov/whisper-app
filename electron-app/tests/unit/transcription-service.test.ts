import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import { EventEmitter } from 'events';
import {
  transcribe,
  _setHttpClient,
  TranscriptionError,
  type HttpClient,
  type TranscriptionSettings,
} from '../../src/main/services/transcription-service';

// Default test settings
const defaultSettings: TranscriptionSettings = {
  apiKey: 'sk-test-key-123',
  apiBaseURL: 'https://api.openai.com/v1',
  modelName: 'whisper-1',
  language: '',
};

// Temp file for audio
let tempAudioFile: string;

/**
 * Creates a mock HTTP client that returns canned responses.
 * handler receives the request body and returns { statusCode, body }.
 */
function createMockHttpClient(
  handler: (reqBody: Buffer) => { statusCode: number; body: string }
): { client: HttpClient; requestCount: () => number } {
  let count = 0;

  const client: HttpClient = {
    request(
      _url: URL,
      _options: http.RequestOptions,
      callback: (res: http.IncomingMessage) => void
    ): http.ClientRequest {
      count++;

      // Create a mock request
      const req = new EventEmitter() as http.ClientRequest;
      const bodyChunks: Buffer[] = [];

      req.write = (chunk: unknown) => {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        return true;
      };

      req.end = () => {
        const reqBody = Buffer.concat(bodyChunks);
        const result = handler(reqBody);

        // Create a mock response
        const res = new EventEmitter() as http.IncomingMessage;
        res.statusCode = result.statusCode;

        // Deliver response async (like real HTTP)
        process.nextTick(() => {
          callback(res);
          res.emit('data', Buffer.from(result.body));
          res.emit('end');
        });

        return req;
      };

      req.destroy = () => req;

      return req;
    },
  };

  return { client, requestCount: () => count };
}

/**
 * Creates a mock HTTP client that returns different responses per attempt.
 */
function createSequenceMockClient(
  responses: Array<{ statusCode: number; body: string }>
): { client: HttpClient; requestCount: () => number } {
  let count = 0;

  const client: HttpClient = {
    request(
      _url: URL,
      _options: http.RequestOptions,
      callback: (res: http.IncomingMessage) => void
    ): http.ClientRequest {
      const attemptIndex = count;
      count++;

      const req = new EventEmitter() as http.ClientRequest;

      req.write = () => true;

      req.end = () => {
        const response = responses[attemptIndex] ?? responses[responses.length - 1];
        const res = new EventEmitter() as http.IncomingMessage;
        res.statusCode = response.statusCode;

        process.nextTick(() => {
          callback(res);
          res.emit('data', Buffer.from(response.body));
          res.emit('end');
        });

        return req;
      };

      req.destroy = () => req;

      return req;
    },
  };

  return { client, requestCount: () => count };
}

describe('Transcription Service', () => {
  beforeEach(() => {
    // Create a temp WAV file with minimal data
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-test-'));
    tempAudioFile = path.join(tempDir, 'test.wav');
    fs.writeFileSync(tempAudioFile, Buffer.from('RIFF fake wav data'));

    // Use zero delays for tests
    vi.mock('../../src/shared/constants', async (importOriginal) => {
      const actual = (await importOriginal()) as Record<string, unknown>;
      return {
        ...actual,
        MAX_RETRIES: 3,
        RETRY_DELAYS_MS: [0, 0, 0],
        WHISPER_TIMEOUT_MS: 5000,
      };
    });
  });

  afterEach(() => {
    _setHttpClient(null);
    vi.restoreAllMocks();

    // Clean up temp files
    if (fs.existsSync(tempAudioFile)) {
      const dir = path.dirname(tempAudioFile);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // Test 1: Returns text on 200 response
  it('should return transcribed text on 200 response', async () => {
    const { client } = createMockHttpClient(() => ({
      statusCode: 200,
      body: JSON.stringify({ text: 'Hello world' }),
    }));
    _setHttpClient(client);

    const result = await transcribe(tempAudioFile, defaultSettings);
    expect(result).toBe('Hello world');
  });

  // Test 2: Retries on 500 (checks retry count)
  it('should retry on 500 server error', async () => {
    const { client, requestCount } = createSequenceMockClient([
      { statusCode: 500, body: 'Internal Server Error' },
      { statusCode: 500, body: 'Internal Server Error' },
      { statusCode: 200, body: JSON.stringify({ text: 'Success after retries' }) },
    ]);
    _setHttpClient(client);

    const result = await transcribe(tempAudioFile, defaultSettings);
    expect(result).toBe('Success after retries');
    expect(requestCount()).toBe(3);
  });

  // Test 3: Retries on 429 (rate limit)
  it('should retry on 429 rate limit', async () => {
    const { client, requestCount } = createSequenceMockClient([
      { statusCode: 429, body: 'Rate limited' },
      { statusCode: 200, body: JSON.stringify({ text: 'After rate limit' }) },
    ]);
    _setHttpClient(client);

    const result = await transcribe(tempAudioFile, defaultSettings);
    expect(result).toBe('After rate limit');
    expect(requestCount()).toBe(2);
  });

  // Test 4: Does NOT retry on 400 (bad request)
  it('should NOT retry on 400 bad request', async () => {
    const { client, requestCount } = createMockHttpClient(() => ({
      statusCode: 400,
      body: 'Bad Request',
    }));
    _setHttpClient(client);

    await expect(transcribe(tempAudioFile, defaultSettings)).rejects.toThrow(
      TranscriptionError
    );
    expect(requestCount()).toBe(1);
  });

  // Test 5: Does NOT retry on 401 (unauthorized)
  it('should NOT retry on 401 unauthorized', async () => {
    const { client, requestCount } = createMockHttpClient(() => ({
      statusCode: 401,
      body: 'Unauthorized',
    }));
    _setHttpClient(client);

    await expect(transcribe(tempAudioFile, defaultSettings)).rejects.toThrow(
      TranscriptionError
    );
    expect(requestCount()).toBe(1);
  });

  // Test 6: Throws on empty API key
  it('should throw on empty API key', async () => {
    const settingsNoKey: TranscriptionSettings = {
      ...defaultSettings,
      apiKey: '',
    };

    await expect(transcribe(tempAudioFile, settingsNoKey)).rejects.toThrow(
      TranscriptionError
    );

    try {
      await transcribe(tempAudioFile, settingsNoKey);
    } catch (err) {
      expect(err).toBeInstanceOf(TranscriptionError);
      expect((err as TranscriptionError).code).toBe('NO_API_KEY');
    }
  });

  // Test 7: Includes language field when non-empty
  it('should include language field when language is non-empty', async () => {
    let capturedBody: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: JSON.stringify({ text: 'With language' }) };
    });
    _setHttpClient(client);

    const settingsWithLang: TranscriptionSettings = {
      ...defaultSettings,
      language: 'en',
    };

    await transcribe(tempAudioFile, settingsWithLang);

    const bodyStr = capturedBody.toString('utf-8');
    expect(bodyStr).toContain('name="language"');
    expect(bodyStr).toContain('en');
  });

  // Test 8: Skips language field when empty
  it('should skip language field when language is empty', async () => {
    let capturedBody: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: JSON.stringify({ text: 'No language' }) };
    });
    _setHttpClient(client);

    const settingsNoLang: TranscriptionSettings = {
      ...defaultSettings,
      language: '',
    };

    await transcribe(tempAudioFile, settingsNoLang);

    const bodyStr = capturedBody.toString('utf-8');
    expect(bodyStr).not.toContain('name="language"');
  });

  // Test 9: Constructs multipart body correctly (model field, file field present)
  it('should construct multipart body with model and file fields', async () => {
    let capturedBody: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: JSON.stringify({ text: 'Body check' }) };
    });
    _setHttpClient(client);

    await transcribe(tempAudioFile, defaultSettings);

    const bodyStr = capturedBody.toString('utf-8');

    // Check model field
    expect(bodyStr).toContain('name="model"');
    expect(bodyStr).toContain('whisper-1');

    // Check response_format field
    expect(bodyStr).toContain('name="response_format"');
    expect(bodyStr).toContain('json');

    // Check file field
    expect(bodyStr).toContain('name="file"');
    expect(bodyStr).toContain('filename="audio.wav"');
    expect(bodyStr).toContain('Content-Type: audio/wav');

    // Check boundary structure
    expect(bodyStr).toMatch(/^--Boundary-/);
    expect(bodyStr).toMatch(/--Boundary-[a-f0-9-]+--\r\n$/);
  });

  // Additional: exhausts retries on persistent 500
  it('should throw after exhausting all retries on persistent 500', async () => {
    const { client, requestCount } = createMockHttpClient(() => ({
      statusCode: 500,
      body: 'Server Error',
    }));
    _setHttpClient(client);

    await expect(transcribe(tempAudioFile, defaultSettings)).rejects.toThrow(
      TranscriptionError
    );
    expect(requestCount()).toBe(3);
  });

  // Additional: invalid URL
  it('should throw on invalid API base URL', async () => {
    const badSettings: TranscriptionSettings = {
      ...defaultSettings,
      apiBaseURL: 'not-a-valid-url',
    };

    await expect(transcribe(tempAudioFile, badSettings)).rejects.toThrow(TranscriptionError);

    try {
      await transcribe(tempAudioFile, badSettings);
    } catch (err) {
      expect(err).toBeInstanceOf(TranscriptionError);
      expect((err as TranscriptionError).code).toBe('INVALID_URL');
    }
  });

  // Additional: retries on 408 timeout
  it('should retry on 408 timeout', async () => {
    const { client, requestCount } = createSequenceMockClient([
      { statusCode: 408, body: 'Request Timeout' },
      { statusCode: 200, body: JSON.stringify({ text: 'After timeout retry' }) },
    ]);
    _setHttpClient(client);

    const result = await transcribe(tempAudioFile, defaultSettings);
    expect(result).toBe('After timeout retry');
    expect(requestCount()).toBe(2);
  });
});
