import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { appStateManager } from './app-state';
import {
  registerIpcHandlers,
  openSettingsWindow,
  openHistoryWindow,
  openOnboardingWindow,
  createOverlayWindow,
} from './ipc-handlers';
import { TrayManager } from './tray';

let mainWindow: BrowserWindow | null = null;
const trayManager = new TrayManager();

// --- macOS dock visibility management ---
let openWindowCount = 0;
let dockHideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows or hides the macOS dock icon based on the number of open windows.
 * When windows are open, the dock icon is shown so the app appears in Cmd+Tab.
 * When all windows close, the dock icon is hidden after a short delay (100ms)
 * to allow close animations to finish.
 */
function updateDockVisibility(count: number): void {
  if (process.platform !== 'darwin' || !app.dock) {
    return;
  }

  if (dockHideTimer) {
    clearTimeout(dockHideTimer);
    dockHideTimer = null;
  }

  if (count > 0) {
    app.dock.show();
  } else {
    dockHideTimer = setTimeout(() => {
      if (process.platform === 'darwin' && app.dock && openWindowCount === 0) {
        app.dock.hide();
      }
      dockHideTimer = null;
    }, 100);
  }
}

/**
 * Registers a BrowserWindow for dock visibility tracking on macOS.
 * When the window is shown, the dock icon appears; when closed,
 * the dock icon hides if no other tracked windows remain open.
 */
export function trackWindowForDock(win: BrowserWindow): void {
  openWindowCount += 1;
  updateDockVisibility(openWindowCount);

  win.on('closed', () => {
    openWindowCount = Math.max(openWindowCount - 1, 0);
    updateDockVisibility(openWindowCount);
  });
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development';
  const url = isDev
    ? 'http://localhost:8080'
    : `file://${path.join(__dirname, '../../renderer/index.html')}`;

  mainWindow.loadURL(url);
  appStateManager.setMainWindow(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  app.name = 'WhisperApp';

  // Hide dock icon on macOS — this is a tray-only app by default
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  createWindow();
  registerIpcHandlers(appStateManager);

  // Create the floating overlay window and wire it to app state
  const overlay = createOverlayWindow();
  appStateManager.setOverlayWindow(overlay);

  appStateManager.setRecordingStateListener((state) => {
    trayManager.updateState(state);
  });
  trayManager.initialize(
    () => { openSettingsWindow(); },
    () => { openHistoryWindow(); },
    () => { openOnboardingWindow(); },
    () => { appStateManager.startRecording(); },
    () => { appStateManager.stopRecordingAndTranscribe(); }
  );

  const shouldSkipOnboarding = process.platform !== 'darwin';
  const permissions = appStateManager.checkPermissions();
  const shouldShowOnboarding =
    !shouldSkipOnboarding && (!permissions.accessibility || permissions.microphone !== 'granted');

  console.log('[Startup] Platform:', process.platform, '| Permissions:', JSON.stringify(permissions), '| Show onboarding:', shouldShowOnboarding);

  appStateManager.initialize({ startHotkeyManager: !shouldShowOnboarding });

  if (shouldShowOnboarding) {
    openOnboardingWindow(() => {
      const refreshedPermissions = appStateManager.checkPermissions();
      if (refreshedPermissions.accessibility) {
        appStateManager.startHotkeyManager();
      }
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  trayManager.destroy();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
