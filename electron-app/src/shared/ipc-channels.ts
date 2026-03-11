/**
 * IPC channel names shared between main and renderer processes.
 */

export const IPC = {
  // Renderer → Main (invoke/send)
  START_RECORDING: 'start-recording',
  STOP_RECORDING: 'stop-recording',
  CANCEL_RECORDING: 'cancel-recording',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  GET_HISTORY: 'get-history',
  DELETE_ENTRY: 'delete-entry',
  CLEAR_HISTORY: 'clear-history',
  RETRY_TRANSCRIPTION: 'retry-transcription',
  COPY_TO_CLIPBOARD: 'copy-to-clipboard',
  PLAY_AUDIO: 'play-audio',
  STOP_AUDIO: 'stop-audio',
  START_HOTKEY_CAPTURE: 'start-hotkey-capture',
  STOP_HOTKEY_CAPTURE: 'stop-hotkey-capture',
  SHOW_SETTINGS: 'show-settings',
  SHOW_HISTORY: 'show-history',
  SHOW_ONBOARDING: 'show-onboarding',
  QUIT_APP: 'quit-app',
  GET_AUDIO_PATH: 'get-audio-path',
  GET_APP_STATE: 'get-app-state',
  CHECK_PERMISSIONS: 'check-permissions',
  REQUEST_MIC_PERMISSION: 'request-mic-permission',
  REQUEST_ACCESSIBILITY: 'request-accessibility',
  OPEN_ACCESSIBILITY_SETTINGS: 'open-accessibility-settings',
  WINDOW_CLOSE: 'window-close',
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window-toggle-maximize',
  RECORDING_DATA: 'recording-data',
  WAYLAND_NOTIFY: 'wayland-notify',

  // Main → Renderer (push via webContents.send)
  STATE_UPDATE: 'state-update',
  OVERLAY_UPDATE: 'overlay-update',
  HOTKEY_CAPTURED: 'hotkey-captured',
  WAYLAND_PASTE_NOTIFICATION: 'wayland-paste-notification',
} as const;

export type IpcChannel = typeof IPC[keyof typeof IPC];
