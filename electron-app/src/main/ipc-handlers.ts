import { app, BrowserWindow, clipboard, ipcMain, screen, shell, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { IPC } from '../shared/ipc-channels';
import { AppSettings } from '../shared/types';
import { AppStateManager } from './app-state';
import { getRecordingsDir } from './services/history-service';
import { trackWindowForDock } from './main';

let settingsWindow: BrowserWindow | null = null;
let historyWindow: BrowserWindow | null = null;
let onboardingWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let appStateRef: AppStateManager | null = null;

function buildFramelessWindowOptions() {
  return {
    frame: false,
    backgroundColor: '#f1ede4',
  };
}

export function openOnboardingWindow(): BrowserWindow {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.focus();
    return onboardingWindow;
  }

  onboardingWindow = new BrowserWindow({
    ...buildFramelessWindowOptions(),
    width: 860,
    height: 520,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'WhisperApp Setup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  onboardingWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
    query: { view: 'onboarding' },
  });

  trackWindowForDock(onboardingWindow);
  appStateRef?.trackStateWindow(onboardingWindow);
  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
  });

  return onboardingWindow;
}

export function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    ...buildFramelessWindowOptions(),
    width: 1020,
    height: 540,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
    query: { view: 'settings' },
  });
  trackWindowForDock(settingsWindow);
  appStateRef?.trackStateWindow(settingsWindow);
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

export function openHistoryWindow(): void {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }
  historyWindow = new BrowserWindow({
    ...buildFramelessWindowOptions(),
    width: 1040,
    height: 540,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  historyWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
    query: { view: 'history' },
  });
  trackWindowForDock(historyWindow);
  appStateRef?.trackStateWindow(historyWindow);
  historyWindow.on('closed', () => {
    historyWindow = null;
  });
}

/**
 * Creates the floating overlay window — always on top, transparent, click-through.
 * Mirrors the Swift app's OverlayWindowManager: a small panel centered at the
 * bottom of the screen that shows recording/transcribing/done/error status.
 */
export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const overlayWidth = 264;
  const overlayHeight = 48;

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: Math.round(screenWidth / 2 - overlayWidth / 2),
    y: screenHeight - overlayHeight - 24,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  // Make the window click-through (ignore mouse events) — same as Swift's ignoresMouseEvents
  overlayWindow.setIgnoreMouseEvents(true);

  // Keep on top of fullscreen apps
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
    query: { view: 'overlay' },
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

export function registerIpcHandlers(appState: AppStateManager): void {
  appStateRef = appState;
  ipcMain.handle(IPC.START_RECORDING, async () => {
    appState.startRecording();
  });
  ipcMain.handle(IPC.STOP_RECORDING, async () => {
    appState.stopRecordingAndTranscribe();
  });
  ipcMain.handle(IPC.CANCEL_RECORDING, async () => {
    appState.cancelRecording();
  });
  ipcMain.handle(IPC.RETRY_TRANSCRIPTION, async (_event: unknown, entryId: string) => {
    appState.retryTranscription(entryId);
  });
  ipcMain.handle(IPC.SAVE_SETTINGS, async (_event: unknown, settings: AppSettings) => {
    appState.updateSettings(settings);
  });
  ipcMain.handle(IPC.DELETE_ENTRY, async (_event: unknown, entryId: string) => {
    appState.deleteHistoryEntry(entryId);
  });
  ipcMain.handle(IPC.CLEAR_HISTORY, async () => {
    appState.clearHistory();
  });
  ipcMain.handle(IPC.PLAY_AUDIO, async (_event: unknown, payload: { entryId: string; filePath: string }) => {
    appState.toggleAudioPlayback(payload.entryId, payload.filePath);
  });
  ipcMain.handle(IPC.STOP_AUDIO, async () => {
    appState.toggleAudioPlayback('', '');
  });
  ipcMain.handle(IPC.COPY_TO_CLIPBOARD, async (_event: unknown, text: string) => {
    clipboard.writeText(text);
  });
  ipcMain.on(IPC.RECORDING_DATA, (_event: unknown, data: { samples: Float32Array; inputSampleRate: number }) => {
    appState.handleRecordingData(data);
  });
  ipcMain.handle(IPC.START_HOTKEY_CAPTURE, async () => {
  });
  ipcMain.handle(IPC.STOP_HOTKEY_CAPTURE, async () => {
  });
  ipcMain.handle(IPC.REQUEST_MIC_PERMISSION, async () => {
    return appState.requestMicrophonePermission();
  });
  ipcMain.handle(IPC.CHECK_PERMISSIONS, async () => {
    return appState.checkPermissions();
  });
  ipcMain.handle(IPC.REQUEST_ACCESSIBILITY, async () => {
    const accessibility = appState.requestAccessibilityPermission();
    return { ...appState.checkPermissions(), accessibility };
  });
  ipcMain.handle(IPC.OPEN_ACCESSIBILITY_SETTINGS, async () => {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    );
  });
  ipcMain.handle(IPC.OPEN_EXTERNAL_URL, async (_event: unknown, url: string) => {
    await shell.openExternal(url);
  });
  ipcMain.handle(IPC.WINDOW_CLOSE, async (event: IpcMainInvokeEvent) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle(IPC.WINDOW_MINIMIZE, async (event: IpcMainInvokeEvent) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle(IPC.WINDOW_TOGGLE_MAXIMIZE, async (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return;
    }

    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle(IPC.GET_SETTINGS, async () => {
    return appState.getSnapshot().settings;
  });
  ipcMain.handle(IPC.GET_HISTORY, async () => {
    return appState.getSnapshot().history;
  });
  ipcMain.handle(IPC.GET_AUDIO_PATH, async (_event: unknown, relativePath: string) => {
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }

    const normalizedPath = relativePath.replace(/^recordings[\\/]+/, '');
    return path.join(getRecordingsDir(), normalizedPath);
  });

  ipcMain.handle(IPC.SHOW_SETTINGS, async () => {
    openSettingsWindow();
  });
  ipcMain.handle(IPC.SHOW_HISTORY, async () => {
    openHistoryWindow();
  });
  ipcMain.handle(IPC.SHOW_ONBOARDING, async () => {
    openOnboardingWindow();
  });
  ipcMain.handle(IPC.COMPLETE_ONBOARDING, async () => {
    const current = appState.getSnapshot().settings;
    appState.updateSettings({ ...current, onboardingCompleted: true });
  });
  ipcMain.handle(IPC.QUIT_APP, async () => {
    app.quit();
  });

  ipcMain.handle(IPC.GET_APP_STATE, async () => appState.getSnapshot());
}
