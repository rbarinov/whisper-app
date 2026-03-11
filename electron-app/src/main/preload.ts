import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

contextBridge.exposeInMainWorld('api', {
  startRecording: () => ipcRenderer.invoke(IPC.START_RECORDING),
  stopRecording: () => ipcRenderer.invoke(IPC.STOP_RECORDING),
  cancelRecording: () => ipcRenderer.invoke(IPC.CANCEL_RECORDING),
  sendRecordingData: (samples: number[], inputSampleRate: number) =>
    ipcRenderer.send(IPC.RECORDING_DATA, { samples, inputSampleRate }),

  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS),
  saveSettings: (settings: unknown) => ipcRenderer.invoke(IPC.SAVE_SETTINGS, settings),

  getHistory: () => ipcRenderer.invoke(IPC.GET_HISTORY),
  deleteEntry: (entryId: string) => ipcRenderer.invoke(IPC.DELETE_ENTRY, entryId),
  clearHistory: () => ipcRenderer.invoke(IPC.CLEAR_HISTORY),
  retryTranscription: (entryId: string) => ipcRenderer.invoke(IPC.RETRY_TRANSCRIPTION, entryId),

  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.COPY_TO_CLIPBOARD, text),

  playAudio: (entryId: string, filePath: string) =>
    ipcRenderer.invoke(IPC.PLAY_AUDIO, { entryId, filePath }),
  stopAudio: () => ipcRenderer.invoke(IPC.STOP_AUDIO),
  getAudioPath: (relativeAudioPath: string) => ipcRenderer.invoke(IPC.GET_AUDIO_PATH, relativeAudioPath),

  showSettings: () => ipcRenderer.invoke(IPC.SHOW_SETTINGS),
  showHistory: () => ipcRenderer.invoke(IPC.SHOW_HISTORY),
  showOnboarding: () => ipcRenderer.invoke(IPC.SHOW_ONBOARDING),
  quit: () => ipcRenderer.invoke(IPC.QUIT_APP),

  startHotkeyCapture: () => ipcRenderer.invoke(IPC.START_HOTKEY_CAPTURE),
  stopHotkeyCapture: () => ipcRenderer.invoke(IPC.STOP_HOTKEY_CAPTURE),
  checkPermissions: () => ipcRenderer.invoke(IPC.CHECK_PERMISSIONS),
  requestMicrophonePermission: () => ipcRenderer.invoke(IPC.REQUEST_MIC_PERMISSION),
  requestAccessibility: () => ipcRenderer.invoke(IPC.REQUEST_ACCESSIBILITY),
  openAccessibilitySettings: () => ipcRenderer.invoke(IPC.OPEN_ACCESSIBILITY_SETTINGS),
  openExternalUrl: (url: string) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL_URL, url),
  closeWindow: () => ipcRenderer.invoke(IPC.WINDOW_CLOSE),
  minimizeWindow: () => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IPC.WINDOW_TOGGLE_MAXIMIZE),

  onStateUpdate: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on(IPC.STATE_UPDATE, listener);
    return () => ipcRenderer.removeListener(IPC.STATE_UPDATE, listener);
  },
  onOverlayUpdate: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on(IPC.OVERLAY_UPDATE, listener);
    return () => ipcRenderer.removeListener(IPC.OVERLAY_UPDATE, listener);
  },
  onHotkeyCaptured: (callback: (key: string) => void) => {
    const listener = (_event: unknown, key: string) => callback(key);
    ipcRenderer.on(IPC.HOTKEY_CAPTURED, listener);
    return () => ipcRenderer.removeListener(IPC.HOTKEY_CAPTURED, listener);
  },
  onWaylandNotify: (callback: (message: string) => void) => {
    const listener = (_event: unknown, message: string) => callback(message);
    ipcRenderer.on(IPC.WAYLAND_PASTE_NOTIFICATION, listener);
    return () => ipcRenderer.removeListener(IPC.WAYLAND_PASTE_NOTIFICATION, listener);
  },

  getAppState: () => ipcRenderer.invoke(IPC.GET_APP_STATE),
});
