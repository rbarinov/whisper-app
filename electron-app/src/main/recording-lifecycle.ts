import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { MIN_RECORDING_DURATION_S } from '../shared/constants';
import type { AppSettings, OverlayState, RecordingState, TranscriptionEntry } from '../shared/types';
import {
  addEntry,
  getEntries,
  getRecordingsDir,
  loadHistory,
  updateEntry,
} from './services/history-service';
import { encodeWAV, saveRecording } from './services/audio-recorder';
import { processWithLLM } from './services/llm-service';
import { pasteText } from './services/paste-service';
import { transcribe } from './services/transcription-service';

export interface RendererRecordingData {
  samples: Float32Array;
  inputSampleRate: number;
}

/** Mutable state bag that the lifecycle functions read/write through. */
export interface LifecycleContext {
  activeTranscriptionEntryId: string | null;
  currentAbortController: AbortController | null;
  lastRecordingBuffer: Buffer | null;
  recordingState: RecordingState;
  overlayState: OverlayState;
  history: TranscriptionEntry[];
  settings: AppSettings;

  applyRecordingState(state: RecordingState): void;
  broadcastStateUpdate(): void;
  broadcastOverlayUpdate(state: OverlayState): void;
  scheduleOverlayDismiss(state: OverlayState): void;
  sendWaylandPasteNotification(message: string): void;
  waitForRecordingData(): Promise<RendererRecordingData>;
}

export async function runRecordingLifecycle(ctx: LifecycleContext): Promise<void> {
  const entryId = randomUUID();
  ctx.activeTranscriptionEntryId = entryId;
  addEntry({ id: entryId, status: 'transcribing' });
  ctx.history = loadHistory();
  ctx.broadcastStateUpdate();

  ctx.currentAbortController?.abort();
  ctx.currentAbortController = new AbortController();

  try {
    const recordingData = await ctx.waitForRecordingData();
    const wavBuffer = encodeWAV(recordingData.samples, recordingData.inputSampleRate);
    ctx.lastRecordingBuffer = wavBuffer;
    const recording = await saveRecording(
      recordingData.samples,
      recordingData.inputSampleRate,
      getRecordingsDir()
    );

    const relativeAudioPath = path.basename(recording.filePath);
    if (recording.duration < MIN_RECORDING_DURATION_S) {
      updateEntry(entryId, {
        status: 'cancelled',
        durationSeconds: recording.duration,
        audioFilePath: relativeAudioPath,
      });
      ctx.history = loadHistory();
      ctx.activeTranscriptionEntryId = null;
      ctx.recordingState = { type: 'idle' };
      ctx.overlayState = { type: 'cancelled' };
      ctx.applyRecordingState(ctx.recordingState);
      ctx.broadcastStateUpdate();
      ctx.broadcastOverlayUpdate(ctx.overlayState);
      ctx.scheduleOverlayDismiss(ctx.overlayState);
      return;
    }

    await runTranscriptionFromBuffer(ctx, ctx.lastRecordingBuffer ?? wavBuffer, entryId, {
      durationSeconds: recording.duration,
      audioFilePath: relativeAudioPath,
    });
  } catch (error) {
    if (ctx.activeTranscriptionEntryId !== entryId) {
      ctx.history = loadHistory();
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    try {
      updateEntry(entryId, {
        status: 'failed',
        errorMessage: message,
      });
    } catch (e) { console.error('Failed to update failed entry:', e); }

    ctx.history = loadHistory();
    ctx.activeTranscriptionEntryId = null;
    ctx.recordingState = { type: 'error', message };
    ctx.overlayState = { type: 'error', message };
    ctx.applyRecordingState(ctx.recordingState);
    ctx.broadcastStateUpdate();
    ctx.broadcastOverlayUpdate(ctx.overlayState);
    ctx.scheduleOverlayDismiss(ctx.overlayState);
  } finally {
    ctx.currentAbortController = null;
  }
}

export async function runRetryLifecycle(
  ctx: LifecycleContext,
  entryId: string,
  wavBuffer: Buffer,
  entryAudioMetadata: { durationSeconds: number; audioFilePath: string }
): Promise<void> {
  try {
    await runTranscriptionFromBuffer(ctx, wavBuffer, entryId, entryAudioMetadata);
  } catch (error) {
    if (ctx.activeTranscriptionEntryId !== entryId) {
      ctx.history = loadHistory();
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    try {
      updateEntry(entryId, {
        status: 'failed',
        errorMessage: message,
      });
    } catch (e) { console.error('Failed to update failed entry:', e); }

    ctx.history = loadHistory();
    ctx.activeTranscriptionEntryId = null;
    ctx.recordingState = { type: 'error', message };
    ctx.overlayState = { type: 'error', message };
    ctx.applyRecordingState(ctx.recordingState);
    ctx.broadcastStateUpdate();
    ctx.broadcastOverlayUpdate(ctx.overlayState);
    ctx.scheduleOverlayDismiss(ctx.overlayState);
  } finally {
    ctx.currentAbortController = null;
  }
}

async function runTranscriptionFromBuffer(
  ctx: LifecycleContext,
  wavBuffer: Buffer,
  entryId: string,
  entryAudioMetadata?: { durationSeconds: number; audioFilePath: string }
): Promise<void> {
  const rawText = await transcribe(wavBuffer, {
    apiBaseURL: ctx.settings.apiBaseURL,
    apiKey: ctx.settings.apiKey,
    modelName: ctx.settings.modelName,
    language: ctx.settings.language,
  }, {
    signal: ctx.currentAbortController?.signal,
  });

  let finalText = rawText;
  let errorMessage: string | undefined;

  if (ctx.activeTranscriptionEntryId !== entryId) {
    return;
  }

  if (ctx.settings.llmPostProcessingEnabled) {
    ctx.recordingState = { type: 'processing' };
    ctx.overlayState = { type: 'processing' };
    ctx.applyRecordingState(ctx.recordingState);
    ctx.broadcastStateUpdate();
    ctx.broadcastOverlayUpdate(ctx.overlayState);

    try {
      finalText = await processWithLLM(rawText, {
        apiBaseURL: ctx.settings.llmApiBaseURL.trim() || ctx.settings.apiBaseURL,
        apiKey: ctx.settings.llmApiKey.trim() || ctx.settings.apiKey,
        llmModelName: ctx.settings.llmModelName,
        llmSystemPrompt: ctx.settings.llmSystemPrompt,
      }, {
        signal: ctx.currentAbortController?.signal,
      });
    } catch (error) {
      finalText = rawText;
      const reason = error instanceof Error ? error.message : String(error);
      errorMessage = `LLM failed: ${reason}`;
    }
  }

  if (ctx.activeTranscriptionEntryId !== entryId) {
    return;
  }

  updateEntry(entryId, {
    status: 'successful',
    ...entryAudioMetadata,
    rawText,
    text: finalText,
    errorMessage,
  });

  ctx.history = loadHistory();
  ctx.activeTranscriptionEntryId = null;
  ctx.recordingState = { type: 'idle' };
  ctx.overlayState = { type: 'done', text: finalText };
  ctx.applyRecordingState(ctx.recordingState);
  ctx.broadcastStateUpdate();
  ctx.broadcastOverlayUpdate(ctx.overlayState);
  ctx.scheduleOverlayDismiss(ctx.overlayState);

  const pasteResult = await pasteText(finalText);
  if (pasteResult.method === 'clipboard-only' && pasteResult.message) {
    ctx.sendWaylandPasteNotification(pasteResult.message);
  }
}

/**
 * Persist a cancelled recording to disk and history.
 * Shared by handleRecordingData and cancelRecording in AppStateManager.
 */
export function persistCancelledRecording(
  wavBuffer: Buffer,
  durationSeconds: number
): void {
  const entryId = randomUUID();
  const relativeAudioPath = `${entryId}.wav`;
  const absoluteAudioPath = path.join(getRecordingsDir(), relativeAudioPath);
  try {
    fs.mkdirSync(getRecordingsDir(), { recursive: true });
    fs.writeFileSync(absoluteAudioPath, wavBuffer);
    addEntry({
      id: entryId,
      status: 'cancelled',
      durationSeconds,
      audioFilePath: relativeAudioPath,
    });
  } catch (error) {
    console.error('Failed to persist cancelled recording:', error);
  }
}

export interface RetryPreparation {
  retryEntryId: string;
  wavBuffer: Buffer;
  durationSeconds: number;
  audioFilePath: string;
}

/**
 * Validate and prepare data for a retry transcription.
 * Returns null if the entry is not eligible for retry.
 */
export function prepareRetryTranscription(
  entryId: string
): RetryPreparation | null {
  const entry = getEntries().find((candidate) => candidate.id === entryId);
  if (!entry || !entry.audioFilePath || (entry.status !== 'failed' && entry.status !== 'cancelled')) {
    return null;
  }

  const audioPath = path.join(getRecordingsDir(), entry.audioFilePath);
  if (!fs.existsSync(audioPath)) {
    return null;
  }

  const wavBuffer = fs.readFileSync(audioPath);
  const retryEntryId = randomUUID();
  addEntry({
    id: retryEntryId,
    status: 'transcribing',
    durationSeconds: entry.durationSeconds,
    audioFilePath: entry.audioFilePath,
  });

  return {
    retryEntryId,
    wavBuffer,
    durationSeconds: entry.durationSeconds,
    audioFilePath: entry.audioFilePath,
  };
}
