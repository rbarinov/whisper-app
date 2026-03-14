import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'http';
import { EventEmitter } from 'events';
import {
  processWithLLM,
  _setHttpClient,
  LLMError,
  type HttpClient,
  type LLMSettings,
} from '../../src/main/services/llm-service';

// Default test settings
const defaultSettings: LLMSettings = {
  apiKey: 'sk-test-key-123',
  apiBaseURL: 'https://api.openai.com/v1',
  llmModelName: 'gpt-5-nano',
  llmSystemPrompt: 'You are a post-processor.',
};

/**
 * Creates a mock HTTP client that returns canned responses.
 * handler receives the request body string and returns { statusCode, body }.
 */
function createMockHttpClient(
  handler: (reqBody: string) => { statusCode: number; body: string }
): { client: HttpClient; requestCount: () => number } {
  let count = 0;

  const client: HttpClient = {
    request(
      _url: URL,
      _options: http.RequestOptions,
      callback: (res: http.IncomingMessage) => void
    ): http.ClientRequest {
      count++;

      const req = new EventEmitter() as http.ClientRequest;
      const bodyChunks: Buffer[] = [];

      req.write = (chunk: unknown) => {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        return true;
      };

      req.end = () => {
        const reqBody = Buffer.concat(bodyChunks).toString('utf-8');
        const result = handler(reqBody);

        const res = new EventEmitter() as http.IncomingMessage;
        res.statusCode = result.statusCode;

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

/** Helper to build a valid chat completion response */
function chatResponse(content: string): string {
  return JSON.stringify({
    choices: [{ message: { content } }],
  });
}

describe('LLM Service', () => {
  beforeEach(() => {
    // Use zero delays for tests
    vi.mock('../../src/shared/constants', async (importOriginal) => {
      const actual = (await importOriginal()) as Record<string, unknown>;
      return {
        ...actual,
        MAX_RETRIES: 3,
        RETRY_DELAYS_MS: [0, 0, 0],
        LLM_TIMEOUT_MS: 5000,
      };
    });
  });

  afterEach(() => {
    _setHttpClient(null);
    vi.restoreAllMocks();
  });

  // Test 1: Returns processed text on 200 response
  it('should return processed text on 200 response', async () => {
    const { client } = createMockHttpClient(() => ({
      statusCode: 200,
      body: chatResponse('Processed text output'),
    }));
    _setHttpClient(client);

    const result = await processWithLLM('raw transcription', defaultSettings);
    expect(result).toBe('Processed text output');
  });

  // Test 2: Request body does NOT include reasoning_effort (unsupported by many providers)
  it('should not include reasoning_effort in request body', async () => {
    let capturedBody = '';
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: chatResponse('ok') };
    });
    _setHttpClient(client);

    await processWithLLM('test text', defaultSettings);

    const parsed = JSON.parse(capturedBody);
    expect(parsed.reasoning_effort).toBeUndefined();
  });

  // Test 3: User message wraps text in <transcription> tags
  it('should wrap user text in <transcription> tags', async () => {
    let capturedBody = '';
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: chatResponse('ok') };
    });
    _setHttpClient(client);

    await processWithLLM('Hello world', defaultSettings);

    const parsed = JSON.parse(capturedBody);
    const userMessage = parsed.messages.find(
      (m: { role: string }) => m.role === 'user'
    );
    expect(userMessage).toBeDefined();
    expect(userMessage.content).toBe('<transcription>Hello world</transcription>');
  });

  // Test 4: System prompt included when non-empty
  it('should include system prompt when non-empty', async () => {
    let capturedBody = '';
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: chatResponse('ok') };
    });
    _setHttpClient(client);

    await processWithLLM('text', {
      ...defaultSettings,
      llmSystemPrompt: 'Custom system prompt',
    });

    const parsed = JSON.parse(capturedBody);
    const systemMessage = parsed.messages.find(
      (m: { role: string }) => m.role === 'system'
    );
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toBe('Custom system prompt');
  });

  // Test 5: System prompt omitted when empty
  it('should omit system prompt when empty', async () => {
    let capturedBody = '';
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: chatResponse('ok') };
    });
    _setHttpClient(client);

    await processWithLLM('text', {
      ...defaultSettings,
      llmSystemPrompt: '',
    });

    const parsed = JSON.parse(capturedBody);
    const systemMessage = parsed.messages.find(
      (m: { role: string }) => m.role === 'system'
    );
    expect(systemMessage).toBeUndefined();
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].role).toBe('user');
  });

  // Test 5b: System prompt omitted when whitespace-only
  it('should omit system prompt when whitespace-only', async () => {
    let capturedBody = '';
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: chatResponse('ok') };
    });
    _setHttpClient(client);

    await processWithLLM('text', {
      ...defaultSettings,
      llmSystemPrompt: '   \n  ',
    });

    const parsed = JSON.parse(capturedBody);
    const systemMessage = parsed.messages.find(
      (m: { role: string }) => m.role === 'system'
    );
    expect(systemMessage).toBeUndefined();
  });

  // Test 6: Retries on 500
  it('should retry on 500 server error', async () => {
    const { client, requestCount } = createSequenceMockClient([
      { statusCode: 500, body: 'Internal Server Error' },
      { statusCode: 500, body: 'Internal Server Error' },
      { statusCode: 200, body: chatResponse('Success after retries') },
    ]);
    _setHttpClient(client);

    const result = await processWithLLM('text', defaultSettings);
    expect(result).toBe('Success after retries');
    expect(requestCount()).toBe(3);
  });

  // Test 7: Does NOT retry on 401
  it('should NOT retry on 401 unauthorized', async () => {
    const { client, requestCount } = createMockHttpClient(() => ({
      statusCode: 401,
      body: 'Unauthorized',
    }));
    _setHttpClient(client);

    await expect(processWithLLM('text', defaultSettings)).rejects.toThrow(LLMError);
    expect(requestCount()).toBe(1);
  });

  // Test 8: Throws on empty API key
  it('should throw on empty API key', async () => {
    const settingsNoKey: LLMSettings = {
      ...defaultSettings,
      apiKey: '',
    };

    await expect(processWithLLM('text', settingsNoKey)).rejects.toThrow(LLMError);

    try {
      await processWithLLM('text', settingsNoKey);
    } catch (err) {
      expect(err).toBeInstanceOf(LLMError);
      expect((err as LLMError).code).toBe('NO_API_KEY');
    }
  });

  // Additional: model name is sent correctly
  it('should send the correct model name in request body', async () => {
    let capturedBody = '';
    const { client } = createMockHttpClient((reqBody) => {
      capturedBody = reqBody;
      return { statusCode: 200, body: chatResponse('ok') };
    });
    _setHttpClient(client);

    await processWithLLM('text', {
      ...defaultSettings,
      llmModelName: 'custom-model',
    });

    const parsed = JSON.parse(capturedBody);
    expect(parsed.model).toBe('custom-model');
  });

  // Additional: trims response content
  it('should trim whitespace from response content', async () => {
    const { client } = createMockHttpClient(() => ({
      statusCode: 200,
      body: chatResponse('  trimmed output  \n'),
    }));
    _setHttpClient(client);

    const result = await processWithLLM('text', defaultSettings);
    expect(result).toBe('trimmed output');
  });

  // Additional: throws after exhausting retries on persistent 500
  it('should throw after exhausting all retries on persistent 500', async () => {
    const { client, requestCount } = createMockHttpClient(() => ({
      statusCode: 500,
      body: 'Server Error',
    }));
    _setHttpClient(client);

    await expect(processWithLLM('text', defaultSettings)).rejects.toThrow(LLMError);
    expect(requestCount()).toBe(3);
  });

  // Additional: retries on 429 rate limit
  it('should retry on 429 rate limit', async () => {
    const { client, requestCount } = createSequenceMockClient([
      { statusCode: 429, body: 'Rate limited' },
      { statusCode: 200, body: chatResponse('After rate limit') },
    ]);
    _setHttpClient(client);

    const result = await processWithLLM('text', defaultSettings);
    expect(result).toBe('After rate limit');
    expect(requestCount()).toBe(2);
  });

  // Additional: does NOT retry on 400
  it('should NOT retry on 400 bad request', async () => {
    const { client, requestCount } = createMockHttpClient(() => ({
      statusCode: 400,
      body: 'Bad Request',
    }));
    _setHttpClient(client);

    await expect(processWithLLM('text', defaultSettings)).rejects.toThrow(LLMError);
    expect(requestCount()).toBe(1);
  });

  // Additional: invalid URL
  it('should throw on invalid API base URL', async () => {
    const badSettings: LLMSettings = {
      ...defaultSettings,
      apiBaseURL: 'not-a-valid-url',
    };

    await expect(processWithLLM('text', badSettings)).rejects.toThrow(LLMError);

    try {
      await processWithLLM('text', badSettings);
    } catch (err) {
      expect(err).toBeInstanceOf(LLMError);
      expect((err as LLMError).code).toBe('INVALID_URL');
    }
  });
});
