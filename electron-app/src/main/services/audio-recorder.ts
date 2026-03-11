import * as fs from 'fs';
import * as path from 'path';

const TARGET_SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const WAV_HEADER_SIZE = 44;

export interface RecordingResult {
  filePath: string;
  duration: number;
  sampleCount: number;
}

export function resampleTo16kHz(samples: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate <= 0) {
    throw new Error('inputSampleRate must be greater than 0');
  }

  if (samples.length === 0) {
    return new Float32Array(0);
  }

  if (inputSampleRate === TARGET_SAMPLE_RATE) {
    return samples;
  }

  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const sourcePosition = i * ratio;
    const leftIndex = Math.floor(sourcePosition);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const interpolation = sourcePosition - leftIndex;

    output[i] = samples[leftIndex] + (samples[rightIndex] - samples[leftIndex]) * interpolation;
  }

  return output;
}

export function buildWAVHeader(dataLength: number): Buffer {
  const header = Buffer.alloc(WAV_HEADER_SIZE);
  const byteRate = TARGET_SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);
  const chunkSize = 36 + dataLength;

  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(TARGET_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

export function encodeWAV(samples: Float32Array, inputSampleRate: number): Buffer {
  const resampled = resampleTo16kHz(samples, inputSampleRate);
  const pcmData = Buffer.alloc(resampled.length * 2);

  for (let i = 0; i < resampled.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, resampled[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
    pcmData.writeInt16LE(int16, i * 2);
  }

  const header = buildWAVHeader(pcmData.length);
  return Buffer.concat([header, pcmData]);
}

export async function saveRecording(
  samples: Float32Array,
  inputSampleRate: number,
  outputDir: string
): Promise<RecordingResult> {
  const wavBuffer = encodeWAV(samples, inputSampleRate);

  await fs.promises.mkdir(outputDir, { recursive: true });

  const fileName = `recording-${Date.now()}.wav`;
  const filePath = path.join(outputDir, fileName);
  await fs.promises.writeFile(filePath, wavBuffer);

  const resampledCount = wavBuffer.readUInt32LE(40) / 2;

  return {
    filePath,
    duration: resampledCount / TARGET_SAMPLE_RATE,
    sampleCount: resampledCount,
  };
}
