import { BrowserWindow, systemPreferences } from 'electron';
import {
  MIN_RECORDING_DURATION_S,
  OVERLAY_DISMISS_CANCELLED_MS,
  OVERLAY_DISMISS_DONE_MS,
  OVERLAY_DISMISS_ERROR_MS,
} from '../shared/constants';
import { IPC } from '../shared/ipc-channels';
import type {
  AppSettings,
  AppState,
  HotkeyAction,
  OverlayState,
  RecordingState,
  TranscriptionEntry,
} from '../shared/types';
import { audioPlayerService } from './services/audio-player-service';
import {
  clearAllHistory,
  deleteEntry,
  loadHistory,
  updateEntry,
} from './services/history-service';
import { HotkeyManager } from './services/hotkey-manager';
import { encodeWAV } from './services/audio-recorder';
import { isWaylandSession } from './services/paste-service';
import { loadSettings, saveSettings } from './services/settings-service';
import {
  persistCancelledRecording,
  prepareRetryTranscription,
  runRecordingLifecycle,
  runRetryLifecycle,
} from './recording-lifecycle';
import type { RendererRecordingData, LifecycleContext } from './recording-lifecycle';

export type { RendererRecordingData } from './recording-lifecycle';

export interface AppStateSnapshot extends AppState {
  overlayState: OverlayState;
  isWayland: boolean;
}
export type MicrophonePermissionStatus = 'granted' | 'denied' | 'not-determined';
export interface PermissionSnapshot {
  microphone: MicrophonePermissionStatus;
  accessibility: boolean;
}
export class AppStateManager {
  private recordingState: RecordingState = { type: 'idle' };
  private history: TranscriptionEntry[] = [];
  private settings: AppSettings;
  private isMicrophoneGranted = false;
  private overlayState: OverlayState = { type: 'hidden' };
  private activeTranscriptionEntryId: string | null = null;
  private currentAbortController: AbortController | null = null;
  private lastRecordingBuffer: Buffer | null = null;
  private recordingStartTime: number | null = null;
  private pendingCancelledDurationSeconds: number | null = null;
  private pendingRecordingData:
    | {
      resolve: (data: RendererRecordingData) => void;
      reject: (reason?: unknown) => void;
      timeout: NodeJS.Timeout;
    }
    | null = null;
  private hotkeyManager: HotkeyManager;
  private mainWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private overlayDismissTimer: NodeJS.Timeout | null = null;
  private recordingStateListener: ((state: RecordingState) => void) | null = null;

  private hasMacOSMicApi(): boolean {
    return (
      process.platform === 'darwin' &&
      typeof systemPreferences?.getMediaAccessStatus === 'function' &&
      typeof systemPreferences?.askForMediaAccess === 'function'
    );
  }
  private hasMacOSAccessibilityApi(): boolean {
    return (
      process.platform === 'darwin' &&
      typeof systemPreferences?.isTrustedAccessibilityClient === 'function'
    );
  }
  constructor() {
    this.settings = loadSettings();
    this.history = loadHistory();
    this.hotkeyManager = new HotkeyManager();
    this.hotkeyManager.setActionCallback((action) => this.handleHotkeyAction(action));
  }
  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }
  setOverlayWindow(win: BrowserWindow): void {
    this.overlayWindow = win;
  }
  initialize(options?: { startHotkeyManager?: boolean }): void {
    const permissionSnapshot = this.checkPermissions();
    this.isMicrophoneGranted = permissionSnapshot.microphone === 'granted';

    this.hotkeyManager.setHotkey(this.settings.hotkeyConfig.keyCode);
    this.applyRecordingState(this.recordingState);
    if (options?.startHotkeyManager !== false) {
      this.hotkeyManager.start();
    }
    this.broadcastStateUpdate();
    this.broadcastOverlayUpdate(this.overlayState);
  }
  startHotkeyManager(): void {
    this.hotkeyManager.start();
  }

  getMicrophonePermissionStatus(): MicrophonePermissionStatus {
    if (!this.hasMacOSMicApi()) {
      return 'granted';
    }

    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'granted') {
      return 'granted';
    }

    if (status === 'not-determined') {
      return 'not-determined';
    }

    return 'denied';
  }

  hasAccessibilityPermission(prompt: boolean): boolean {
    if (!this.hasMacOSAccessibilityApi()) {
      return true;
    }

    return systemPreferences.isTrustedAccessibilityClient(prompt);
  }

  checkPermissions(): PermissionSnapshot {
    return {
      microphone: this.getMicrophonePermissionStatus(),
      accessibility: this.hasAccessibilityPermission(false),
    };
  }

  requestAccessibilityPermission(): boolean {
    return this.hasAccessibilityPermission(true);
  }

  setRecordingStateListener(listener: ((state: RecordingState) => void) | null): void {
    this.recordingStateListener = listener;
  }

  getSnapshot(): AppStateSnapshot {
    const audioState = audioPlayerService.getState();

    return {
      recordingState: this.recordingState,
      history: [...this.history],
      settings: this.settings,
      isMicrophoneGranted: this.isMicrophoneGranted,
      isAudioPlaying: audioState.isPlaying,
      playingEntryId: audioState.playingEntryId,
      overlayState: this.overlayState,
      isWayland: isWaylandSession(),
    };
  }

  startRecording(): void {
    if (this.recordingState.type !== 'idle' && this.recordingState.type !== 'error') {
      return;
    }

    if (this.hasMacOSMicApi() && !this.isMicrophoneGranted) {
      void this.requestMicrophonePermissionAndMaybeFail();
      return;
    }

    this.recordingStartTime = Date.now();
    this.recordingState = { type: 'recording' };
    this.overlayState = { type: 'recording' };
    this.applyRecordingState(this.recordingState);

    this.broadcastStateUpdate();
    this.broadcastOverlayUpdate(this.overlayState);
  }

  async requestMicrophonePermission(): Promise<boolean> {
    if (!this.hasMacOSMicApi()) {
      this.isMicrophoneGranted = true;
      this.broadcastStateUpdate();
      return true;
    }

    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'granted') {
      this.isMicrophoneGranted = true;
      this.broadcastStateUpdate();
      return true;
    }

    const granted = await systemPreferences.askForMediaAccess('microphone');
    this.isMicrophoneGranted = granted;
    this.broadcastStateUpdate();
    return granted;
  }

  stopRecordingAndTranscribe(): void {
    if (this.recordingState.type !== 'recording') {
      return;
    }

    this.recordingStartTime = null;
    this.recordingState = { type: 'transcribing' };
    this.overlayState = { type: 'transcribing' };
    this.activeTranscriptionEntryId = 'pending';
    this.applyRecordingState(this.recordingState);

    this.broadcastStateUpdate();
    this.broadcastOverlayUpdate(this.overlayState);

    void runRecordingLifecycle(this.lifecycleContext());
  }

  handleRecordingData(data: RendererRecordingData): void {
    if (data.inputSampleRate > 0 && data.samples.length > 0) {
      const wavBuffer = encodeWAV(data.samples, data.inputSampleRate);
      this.lastRecordingBuffer = wavBuffer;

      if (this.pendingCancelledDurationSeconds !== null) {
        persistCancelledRecording(wavBuffer, this.pendingCancelledDurationSeconds);
        this.history = loadHistory();
        this.broadcastStateUpdate();
        this.pendingCancelledDurationSeconds = null;
      }
    }

    if (!this.pendingRecordingData) {
      return;
    }

    const pending = this.pendingRecordingData;
    this.pendingRecordingData = null;
    clearTimeout(pending.timeout);
    pending.resolve(data);
  }

  cancelRecording(): void {
    if (this.recordingState.type === 'idle' && this.activeTranscriptionEntryId === null) {
      return;
    }

    if (this.recordingState.type === 'recording') {
      const recordingDurationMs =
        this.recordingStartTime === null ? 0 : Math.max(0, Date.now() - this.recordingStartTime);
      const meetsMinDuration = recordingDurationMs >= MIN_RECORDING_DURATION_S * 1000;

      this.pendingCancelledDurationSeconds = meetsMinDuration ? recordingDurationMs / 1000 : null;

      if (meetsMinDuration && this.lastRecordingBuffer) {
        persistCancelledRecording(this.lastRecordingBuffer, recordingDurationMs / 1000);
        this.history = loadHistory();
        this.pendingCancelledDurationSeconds = null;
      }

      this.lastRecordingBuffer = null;
    } else if (
      (this.recordingState.type === 'transcribing' || this.recordingState.type === 'processing') &&
      this.activeTranscriptionEntryId &&
      this.activeTranscriptionEntryId !== 'pending'
    ) {
      try {
        updateEntry(this.activeTranscriptionEntryId, {
          status: 'cancelled',
        });
        this.history = loadHistory();
      } catch (e) { console.error('Failed to update cancelled entry:', e); }
    }

    this.currentAbortController?.abort();
    this.currentAbortController = null;
    if (this.pendingRecordingData) {
      clearTimeout(this.pendingRecordingData.timeout);
      this.pendingRecordingData.reject(new Error('Recording cancelled'));
      this.pendingRecordingData = null;
    }
    this.activeTranscriptionEntryId = null;
    this.recordingStartTime = null;
    this.recordingState = { type: 'idle' };
    this.overlayState = { type: 'cancelled' };
    this.applyRecordingState(this.recordingState);

    this.broadcastStateUpdate();
    this.broadcastOverlayUpdate(this.overlayState);
    this.scheduleOverlayDismiss(this.overlayState);
  }

  retryTranscription(entryId: string): void {
    if (this.recordingState.type !== 'idle') {
      return;
    }

    const prep = prepareRetryTranscription(entryId);
    if (!prep) {
      return;
    }

    this.lastRecordingBuffer = prep.wavBuffer;
    this.history = loadHistory();

    this.currentAbortController?.abort();
    this.currentAbortController = new AbortController();

    this.activeTranscriptionEntryId = prep.retryEntryId;
    this.recordingState = { type: 'transcribing' };
    this.overlayState = { type: 'transcribing' };
    this.applyRecordingState(this.recordingState);

    this.broadcastStateUpdate();
    this.broadcastOverlayUpdate(this.overlayState);

    void runRetryLifecycle(this.lifecycleContext(), prep.retryEntryId, prep.wavBuffer, {
      durationSeconds: prep.durationSeconds,
      audioFilePath: prep.audioFilePath,
    });
  }

  private lifecycleContext(): LifecycleContext {
    const self = this;
    return {
      get activeTranscriptionEntryId() { return self.activeTranscriptionEntryId; },
      set activeTranscriptionEntryId(v) { self.activeTranscriptionEntryId = v; },
      get currentAbortController() { return self.currentAbortController; },
      set currentAbortController(v) { self.currentAbortController = v; },
      get lastRecordingBuffer() { return self.lastRecordingBuffer; },
      set lastRecordingBuffer(v) { self.lastRecordingBuffer = v; },
      get recordingState() { return self.recordingState; },
      set recordingState(v) { self.recordingState = v; },
      get overlayState() { return self.overlayState; },
      set overlayState(v) { self.overlayState = v; },
      get history() { return self.history; },
      set history(v) { self.history = v; },
      get settings() { return self.settings; },
      applyRecordingState: (state) => this.applyRecordingState(state),
      broadcastStateUpdate: () => this.broadcastStateUpdate(),
      broadcastOverlayUpdate: (state) => this.broadcastOverlayUpdate(state),
      scheduleOverlayDismiss: (state) => this.scheduleOverlayDismiss(state),
      sendWaylandPasteNotification: (message) => {
        this.mainWindow?.webContents.send(IPC.WAYLAND_PASTE_NOTIFICATION, message);
      },
      waitForRecordingData: () => this.waitForRecordingData(),
    };
  }

  private waitForRecordingData(): Promise<RendererRecordingData> {
    if (this.pendingRecordingData) {
      clearTimeout(this.pendingRecordingData.timeout);
      this.pendingRecordingData.reject(new Error('Recording request replaced by new request'));
      this.pendingRecordingData = null;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRecordingData = null;
        reject(new Error('Timed out waiting for recording data from renderer'));
      }, 15000);

      this.pendingRecordingData = { resolve, reject, timeout };
    });
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings;
    saveSettings(settings);
    this.hotkeyManager.setHotkey(settings.hotkeyConfig.keyCode);
    this.broadcastStateUpdate();
  }

  deleteHistoryEntry(entryId: string): void {
    deleteEntry(entryId);
    this.history = loadHistory();
    this.broadcastStateUpdate();
  }

  clearHistory(): void {
    clearAllHistory();
    this.history = loadHistory();
    this.broadcastStateUpdate();
  }

  toggleAudioPlayback(entryId: string, filePath: string): void {
    if (!entryId && !filePath) {
      audioPlayerService.stop();
    } else {
      audioPlayerService.toggle(entryId, filePath);
    }

    this.broadcastStateUpdate();
  }

  private handleHotkeyAction(action: HotkeyAction): void {
    switch (action) {
      case 'holdStart':
      case 'toggleOn':
        this.startRecording();
        break;
      case 'holdEnd':
      case 'toggleOff':
        this.stopRecordingAndTranscribe();
        break;
      case 'cancel':
        this.cancelRecording();
        break;
      default:
        break;
    }
  }

  private async requestMicrophonePermissionAndMaybeFail(): Promise<void> {
    const granted = await this.requestMicrophonePermission();
    if (!granted) {
      const message =
        'Microphone permission denied. Enable WhisperApp in System Settings → Privacy & Security → Microphone.';
      this.recordingState = { type: 'error', message };
      this.overlayState = { type: 'error', message };
      this.applyRecordingState(this.recordingState);
      this.broadcastStateUpdate();
      this.broadcastOverlayUpdate(this.overlayState);
      this.scheduleOverlayDismiss(this.overlayState);
      return;
    }

    this.startRecording();
  }

  private applyRecordingState(state: RecordingState): void {
    this.hotkeyManager.setRecordingState(state);
    this.recordingStateListener?.(state);
  }

  private broadcastStateUpdate(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    this.mainWindow.webContents.send(IPC.STATE_UPDATE, this.getSnapshot());
  }

  private broadcastOverlayUpdate(state: OverlayState): void {
    // Cancel any pending dismiss timer when transitioning to an active state.
    // Without this, a previous done/error/cancelled timer could fire and hide
    // the overlay while recording/transcribing/processing is in progress.
    if (state.type === 'recording' || state.type === 'transcribing' || state.type === 'processing') {
      if (this.overlayDismissTimer) {
        clearTimeout(this.overlayDismissTimer);
        this.overlayDismissTimer = null;
      }
    }

    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return;
    }

    this.overlayWindow.webContents.send(IPC.OVERLAY_UPDATE, state);
  }

  private scheduleOverlayDismiss(state: OverlayState): void {
    if (this.overlayDismissTimer) {
      clearTimeout(this.overlayDismissTimer);
      this.overlayDismissTimer = null;
    }

    let timeout: number | null = null;
    switch (state.type) {
      case 'done':
        timeout = OVERLAY_DISMISS_DONE_MS;
        break;
      case 'error':
        timeout = OVERLAY_DISMISS_ERROR_MS;
        break;
      case 'cancelled':
        timeout = OVERLAY_DISMISS_CANCELLED_MS;
        break;
      default:
        timeout = null;
        break;
    }

    if (timeout === null) {
      return;
    }

    this.overlayDismissTimer = setTimeout(() => {
      this.overlayState = { type: 'hidden' };
      this.broadcastOverlayUpdate(this.overlayState);
    }, timeout);
  }
}

export const appStateManager = new AppStateManager();

