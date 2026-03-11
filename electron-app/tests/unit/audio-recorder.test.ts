import { describe, it, expect } from 'vitest';
import {
  buildWAVHeader,
  resampleTo16kHz,
  encodeWAV,
} from '../../src/main/services/audio-recorder';

describe('audio-recorder service pure functions', () => {
  it('buildWAVHeader() returns 44-byte buffer with RIFF/WAVE magic bytes', () => {
    const header = buildWAVHeader(0);

    expect(header.length).toBe(44);
    expect(header.toString('ascii', 0, 4)).toBe('RIFF');
    expect(header.toString('ascii', 8, 12)).toBe('WAVE');
    expect(header.toString('ascii', 12, 16)).toBe('fmt ');
    expect(header.toString('ascii', 36, 40)).toBe('data');
  });

  it('buildWAVHeader(1000) writes correct mono 16kHz 16-bit PCM fields', () => {
    const header = buildWAVHeader(1000);

    expect(header.length).toBe(44);
    expect(header.toString('ascii', 0, 4)).toBe('RIFF');
    expect(header.toString('ascii', 8, 12)).toBe('WAVE');
    expect(header.toString('ascii', 12, 16)).toBe('fmt ');

    expect(header.readUInt16LE(22)).toBe(1);
    expect(header.readUInt32LE(24)).toBe(16000);
    expect(header.readUInt16LE(34)).toBe(16);
  });

  it('resampleTo16kHz(44100Hz) reduces sample length by ~2.756x', () => {
    const input = new Float32Array(44100);
    const output = resampleTo16kHz(input, 44100);

    expect(output.length).toBe(16000);
  });

  it('resampleTo16kHz(48000Hz) reduces sample length by 3x', () => {
    const input = new Float32Array(48000);
    const output = resampleTo16kHz(input, 48000);

    expect(output.length).toBe(16000);
  });

  it('encodeWAV() returns Buffer starting with RIFF', () => {
    const input = new Float32Array(44100);
    const wav = encodeWAV(input, 44100);

    expect(Buffer.isBuffer(wav)).toBe(true);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  });

  it('encodeWAV() writes sampleRate=16000 in WAV header', () => {
    const input = new Float32Array(44100);
    const wav = encodeWAV(input, 44100);

    expect(wav.readUInt32LE(24)).toBe(16000);
  });

  it('encodeWAV() writes correct data chunk size', () => {
    const input = new Float32Array(44100);
    const wav = encodeWAV(input, 44100);

    const dataSize = wav.readUInt32LE(40);
    expect(dataSize).toBe(16000 * 2);
    expect(wav.length).toBe(44 + dataSize);
  });
});
