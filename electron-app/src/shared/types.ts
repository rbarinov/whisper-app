/**
 * Shared TypeScript types used by both main and renderer processes.
 * No electron imports allowed — must work in both contexts.
 */

export type RecordingState =
  | { type: 'idle' }
  | { type: 'recording' }
  | { type: 'transcribing' }
  | { type: 'processing' }
  | { type: 'error'; message: string };

export type TranscriptionStatus = 'recording' | 'transcribing' | 'processing' | 'successful' | 'failed' | 'cancelled';

export interface HotkeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface TranscriptionEntry {
  id: string; // UUID string
  timestamp: string; // ISO 8601
  durationSeconds: number;
  text?: string;
  rawText?: string; // original Whisper output before LLM processing
  status: TranscriptionStatus;
  audioFilePath?: string; // relative path within recordings/ dir
  errorMessage?: string;
}

export interface HotkeyConfig {
  keyCode: number;
  keyName: string;
  modifiers?: HotkeyModifiers;
}

export interface AppSettings {
  apiBaseURL: string;
  apiKey: string;
  modelName: string;
  language: string;
  hotkeyConfig: HotkeyConfig;
  cancelKeyConfig: HotkeyConfig;
  llmPostProcessingEnabled: boolean;
  llmApiBaseURL: string;
  llmApiKey: string;
  llmModelName: string;
  llmSystemPrompt: string;
  onboardingCompleted: boolean;
}

export type OverlayState =
  | { type: 'hidden' }
  | { type: 'recording' }
  | { type: 'transcribing' }
  | { type: 'processing'; text?: string; reasoning?: string }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string }
  | { type: 'cancelled' };

export type HotkeyAction = 'holdStart' | 'holdEnd' | 'toggleOn' | 'toggleOff' | 'cancel';

export interface AppState {
  recordingState: RecordingState;
  isMicrophoneGranted: boolean;
  history: TranscriptionEntry[];
  isAudioPlaying: boolean;
  playingEntryId: string | null;
  settings: AppSettings;
}
