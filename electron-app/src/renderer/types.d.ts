import type { AppSettings, TranscriptionEntry } from '../shared/types';

type PermissionState = {
  microphone: 'granted' | 'denied' | 'not-determined';
  accessibility: boolean;
};

declare global {
  interface Window {
    api: {
      startRecording: () => Promise<void>;
      stopRecording: () => Promise<void>;
      cancelRecording: () => Promise<void>;
      sendRecordingData: (samples: number[], inputSampleRate: number) => void;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (s: AppSettings) => Promise<void>;
      getHistory: () => Promise<TranscriptionEntry[]>;
      deleteEntry: (id: string) => Promise<void>;
      clearHistory: () => Promise<void>;
      retryTranscription: (id: string) => Promise<void>;
      copyToClipboard: (text: string) => Promise<void>;
      playAudio: (entryId: string, filePath: string) => Promise<void>;
      stopAudio: () => Promise<void>;
      getAudioPath: (relPath: string) => Promise<string>;
      showSettings: () => Promise<void>;
      showHistory: () => Promise<void>;
      showOnboarding: () => Promise<void>;
      completeOnboarding: () => Promise<void>;
      quit: () => Promise<void>;
      startHotkeyCapture: () => Promise<void>;
      stopHotkeyCapture: () => Promise<void>;
      checkPermissions: () => Promise<PermissionState>;
      requestMicrophonePermission: () => Promise<boolean>;
      requestAccessibility: () => Promise<PermissionState>;
      openAccessibilitySettings: () => Promise<void>;
      openExternalUrl: (url: string) => Promise<void>;
      closeWindow?: () => Promise<void>;
      minimizeWindow?: () => Promise<void>;
      toggleMaximizeWindow?: () => Promise<void>;
      getAppState: () => Promise<unknown>;
      onStateUpdate: (cb: (state: unknown) => void) => () => void;
      onOverlayUpdate: (cb: (state: unknown) => void) => () => void;
      onHotkeyCaptured: (cb: (key: string) => void) => () => void;
      onWaylandNotify: (cb: (msg: string) => void) => () => void;
    };
  }
}

export {};
