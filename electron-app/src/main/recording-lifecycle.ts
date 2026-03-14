import * as fs from 'fs';
import * as path from 'path';
import { MIN_RECORDING_DURATION_S } from '../shared/constants';
import type { AppSettings, OverlayState, RecordingState, TranscriptionEntry } from '../shared/types';
import {
  getEntries,
  getRecordingsDir,
  loadHistory,
  updateEntry,
} from './services/history-service';
import { encodeWAV, saveRecording } from './services/audio-recorder';
import { processWithLLMStream } from './services/llm-service';
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
  recordingStartTime: number | null;
  pendingCancelledDurationSeconds: number | null;
  pendingCancelledEntryId: string | null;
  pendingRecordingData: PendingRecordingData | null;
  recordingState: RecordingState;
  overlayState: OverlayState;
  history: TranscriptionEntry[];
  settings: AppSettings;
  skipOverlay: boolean;

  applyRecordingState(state: RecordingState): void;
  broadcastStateUpdate(): void;
  broadcastOverlayUpdate(state: OverlayState): void;
  scheduleOverlayDismiss(state: OverlayState): void;
  sendWaylandPasteNotification(message: string): void;
}

export interface PendingRecordingData {
  resolve: (data: RendererRecordingData) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
}

export async function runRecordingLifecycle(ctx: LifecycleContext): Promise<void> {
  // Entry was already created with 'recording' status in startRecording().
  // Reuse the existing entry ID and transition it to 'transcribing'.
  const entryId = ctx.activeTranscriptionEntryId!;
  updateEntry(entryId, { status: 'transcribing' });
  ctx.history = loadHistory();
  ctx.broadcastStateUpdate();

  ctx.currentAbortController?.abort();
  ctx.currentAbortController = new AbortController();

  try {
    const recordingData = await waitForRecordingData(ctx);
    console.log('[DEBUG] got recording data, samples:', recordingData.samples.length, 'sampleRate:', recordingData.inputSampleRate);
    const wavBuffer = encodeWAV(recordingData.samples, recordingData.inputSampleRate);
    ctx.lastRecordingBuffer = wavBuffer;
    const recording = await saveRecording(
      recordingData.samples,
      recordingData.inputSampleRate,
      getRecordingsDir()
    );

    const relativeAudioPath = path.basename(recording.filePath);
    // Persist audio metadata immediately so it survives cancellation during transcription/processing.
    // Without this, cancelling mid-transcription would leave the entry without audioFilePath,
    // hiding Play/Retry buttons in History even though the audio file exists on disk.
    updateEntry(entryId, {
      durationSeconds: recording.duration,
      audioFilePath: relativeAudioPath,
    });
    ctx.history = loadHistory();
    console.log('[DEBUG] recording duration:', recording.duration, 'min required:', MIN_RECORDING_DURATION_S);
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
    console.log('[DEBUG] runRecordingLifecycle caught error:', error);
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
    ctx.applyRecordingState(ctx.recordingState);
    ctx.broadcastStateUpdate();
    if (!ctx.skipOverlay) {
      ctx.overlayState = { type: 'error', message };
      ctx.broadcastOverlayUpdate(ctx.overlayState);
      ctx.scheduleOverlayDismiss(ctx.overlayState);
    }
  } finally {
    ctx.currentAbortController = null;
  }
}

export async function runTranscriptionFromBuffer(
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

  // Persist rawText and audio metadata immediately so they survive cancellation
  updateEntry(entryId, {
    rawText,
    ...entryAudioMetadata,
  });
  ctx.history = loadHistory();

  let finalText = rawText;
  let errorMessage: string | undefined;

  if (ctx.activeTranscriptionEntryId !== entryId) {
    return;
  }

  if (ctx.settings.llmPostProcessingEnabled) {
    updateEntry(entryId, { status: 'processing' });
    ctx.history = loadHistory();
    ctx.recordingState = { type: 'processing' };
    ctx.applyRecordingState(ctx.recordingState);
    ctx.broadcastStateUpdate();
    if (!ctx.skipOverlay) {
      ctx.overlayState = { type: 'processing' };
      ctx.broadcastOverlayUpdate(ctx.overlayState);
    }

    let streamedText = '';
    let reasoningText = '';
    try {
      finalText = await processWithLLMStream(rawText, {
        apiBaseURL: ctx.settings.llmApiBaseURL.trim() || ctx.settings.apiBaseURL,
        apiKey: ctx.settings.llmApiKey.trim() || ctx.settings.apiKey,
        llmModelName: ctx.settings.llmModelName,
        llmSystemPrompt: ctx.settings.llmSystemPrompt,
      }, {
        signal: ctx.currentAbortController?.signal,
        onReasoning: (token: string) => {
          reasoningText += token;
          if (!ctx.skipOverlay) {
            ctx.overlayState = { type: 'processing', reasoning: reasoningText };
            ctx.broadcastOverlayUpdate(ctx.overlayState);
          }
        },
        onToken: (token: string) => {
          streamedText += token;
          if (!ctx.skipOverlay) {
            ctx.overlayState = { type: 'processing', text: streamedText };
            ctx.broadcastOverlayUpdate(ctx.overlayState);
          }
        },
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
  ctx.applyRecordingState(ctx.recordingState);
  ctx.broadcastStateUpdate();
  if (!ctx.skipOverlay) {
    ctx.overlayState = { type: 'done', text: finalText };
    ctx.broadcastOverlayUpdate(ctx.overlayState);
    ctx.scheduleOverlayDismiss(ctx.overlayState);
  }

  const pasteResult = await pasteText(finalText);
  if (pasteResult.method === 'clipboard-only' && pasteResult.message) {
    ctx.sendWaylandPasteNotification(pasteResult.message);
  }
}

export function handleRecordingData(ctx: LifecycleContext, data: RendererRecordingData): void {
  if (data.inputSampleRate > 0 && data.samples.length > 0) {
    const wavBuffer = encodeWAV(data.samples, data.inputSampleRate);
    ctx.lastRecordingBuffer = wavBuffer;

    if (ctx.pendingCancelledDurationSeconds !== null && ctx.pendingCancelledEntryId !== null) {
      const didPersist = persistCancelledRecordingForEntry(wavBuffer, ctx.pendingCancelledDurationSeconds, ctx.pendingCancelledEntryId);
      if (didPersist) {
        ctx.history = loadHistory();
        ctx.broadcastStateUpdate();
      }
      ctx.pendingCancelledDurationSeconds = null;
      ctx.pendingCancelledEntryId = null;
    }
  }

  if (!ctx.pendingRecordingData) {
    return;
  }

  const pending = ctx.pendingRecordingData;
  ctx.pendingRecordingData = null;
  clearTimeout(pending.timeout);
  pending.resolve(data);
}

export function cancelRecording(ctx: LifecycleContext): void {
  if (ctx.recordingState.type === 'idle' && ctx.activeTranscriptionEntryId === null) {
    return;
  }

  if (ctx.recordingState.type === 'recording') {
    const recordingDurationMs =
      ctx.recordingStartTime === null ? 0 : Math.max(0, Date.now() - ctx.recordingStartTime);
    const meetsMinDuration = recordingDurationMs >= MIN_RECORDING_DURATION_S * 1000;
    const entryId = ctx.activeTranscriptionEntryId;

    if (meetsMinDuration && entryId) {
      // Always defer to handleRecordingData — the renderer hasn't stopped recording yet,
      // so lastRecordingBuffer (if set) contains STALE data from a previous recording.
      ctx.pendingCancelledDurationSeconds = recordingDurationMs / 1000;
      ctx.pendingCancelledEntryId = entryId;
    } else if (entryId) {
      // Too short — delete the recording entry
      try {
        updateEntry(entryId, { status: 'cancelled' });
        ctx.history = loadHistory();
      } catch (e) { console.error('Failed to update short cancelled entry:', e); }
    }

    ctx.lastRecordingBuffer = null;
  } else if (
    (ctx.recordingState.type === 'transcribing' || ctx.recordingState.type === 'processing') &&
    ctx.activeTranscriptionEntryId &&
    ctx.activeTranscriptionEntryId !== 'pending'
  ) {
    try {
      updateEntry(ctx.activeTranscriptionEntryId, {
        status: 'cancelled',
      });
      ctx.history = loadHistory();
    } catch (e) {
      console.error('Failed to update cancelled entry:', e);
    }
  }

  ctx.currentAbortController?.abort();
  ctx.currentAbortController = null;
  if (ctx.pendingRecordingData) {
    clearTimeout(ctx.pendingRecordingData.timeout);
    ctx.pendingRecordingData.reject(new Error('Recording cancelled'));
    ctx.pendingRecordingData = null;
  }

  ctx.activeTranscriptionEntryId = null;
  ctx.recordingStartTime = null;
  ctx.recordingState = { type: 'idle' };
  ctx.overlayState = { type: 'cancelled' };
  ctx.applyRecordingState(ctx.recordingState);
  ctx.broadcastStateUpdate();
  ctx.broadcastOverlayUpdate(ctx.overlayState);
  ctx.scheduleOverlayDismiss(ctx.overlayState);
}

export function waitForRecordingData(ctx: LifecycleContext): Promise<RendererRecordingData> {
  if (ctx.pendingRecordingData) {
    clearTimeout(ctx.pendingRecordingData.timeout);
    ctx.pendingRecordingData.reject(new Error('Recording request replaced by new request'));
    ctx.pendingRecordingData = null;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ctx.pendingRecordingData = null;
      reject(new Error('Timed out waiting for recording data from renderer'));
    }, 15000);

    ctx.pendingRecordingData = { resolve, reject, timeout };
  });
}

/**
 * Persist a cancelled recording to disk and update an existing history entry.
 * Used when the entry was already created by startRecording().
 */
export function persistCancelledRecordingForEntry(
  wavBuffer: Buffer,
  durationSeconds: number,
  entryId: string
): boolean {
  const relativeAudioPath = `${entryId}.wav`;
  const absoluteAudioPath = path.join(getRecordingsDir(), relativeAudioPath);
  try {
    fs.mkdirSync(getRecordingsDir(), { recursive: true });
    fs.writeFileSync(absoluteAudioPath, wavBuffer);
    updateEntry(entryId, {
      status: 'cancelled',
      durationSeconds,
      audioFilePath: relativeAudioPath,
    });
    return true;
  } catch (error) {
    console.error('Failed to persist cancelled recording:', error);
    return false;
  }
}

export interface RetryPreparation {
  entryId: string;
  wavBuffer: Buffer;
  durationSeconds: number;
  audioFilePath: string;
}

/**
 * Validate and prepare data for a retry transcription.
 * Updates the existing entry to 'transcribing' status in-place.
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

  // Update the existing entry in-place — keep it visible in history
  updateEntry(entryId, {
    status: 'transcribing',
    errorMessage: undefined,
  });

  return {
    entryId,
    wavBuffer,
    durationSeconds: entry.durationSeconds,
    audioFilePath: entry.audioFilePath,
  };
}
