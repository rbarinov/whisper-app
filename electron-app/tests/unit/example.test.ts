import { describe, it, expect } from 'vitest';
import { DEFAULT_LLM_MODEL_NAME, DEFAULT_MODEL_NAME } from '../../src/shared/constants';

describe('Shared Constants', () => {
  it('should have DEFAULT_LLM_MODEL_NAME set correctly', () => {
    expect(DEFAULT_LLM_MODEL_NAME).toBe('gpt-5-nano');
  });

  it('should have DEFAULT_MODEL_NAME set to whisper-1', () => {
    expect(DEFAULT_MODEL_NAME).toBe('whisper-1');
  });

  it('should pass basic arithmetic test', () => {
    expect(1 + 1).toBe(2);
  });
});
