import { Tray, Menu, nativeImage, nativeTheme, app, NativeImage } from 'electron';
import path from 'path';
import type { RecordingState } from '../shared/types';

/**
 * Manages the system tray icon and context menu.
 * Updates icon and menu items based on app recording state.
 */
export class TrayManager {
  private tray: Tray | null = null;
  private currentState: RecordingState = { type: 'idle' };
  private onShowSettings: (() => void) | null = null;
  private onShowHistory: (() => void) | null = null;
  private onShowOnboarding: (() => void) | null = null;
  private onStartRecording: (() => void) | null = null;
  private onStopRecording: (() => void) | null = null;

  /**
   * Creates the tray icon and sets up the initial context menu.
   */
  initialize(
    onShowSettings: () => void,
    onShowHistory: () => void,
    onShowOnboarding: () => void,
    onStartRecording: () => void,
    onStopRecording: () => void,
  ): void {
    this.onShowSettings = onShowSettings;
    this.onShowHistory = onShowHistory;
    this.onShowOnboarding = onShowOnboarding;
    this.onStartRecording = onStartRecording;
    this.onStopRecording = onStopRecording;

    const icon = this.loadIcon(this.currentState);
    this.tray = new Tray(icon);
    this.tray.setToolTip('WhisperApp');
    this.tray.setContextMenu(this.buildContextMenu(this.currentState));

    // Warn GNOME users that tray icons require an extension
    if (
      process.platform === 'linux' &&
      process.env.XDG_CURRENT_DESKTOP?.includes('GNOME')
    ) {
      console.warn(
        'WhisperApp: GNOME does not show system tray icons by default. ' +
          'Install the AppIndicator extension for GNOME Shell.',
      );
    }

    // On Linux/Windows, listen for theme changes to swap icon color
    if (process.platform !== 'darwin') {
      nativeTheme.on('updated', () => {
        this.updateState(this.currentState);
      });
    }
  }
  /**
   * Updates the tray icon and rebuilds the context menu for the given state.
   */
  updateState(state: RecordingState): void {
    if (!this.tray) {
      return;
    }

    this.currentState = state;
    const icon = this.loadIcon(state);
    this.tray.setImage(icon);
    this.tray.setToolTip(`WhisperApp — ${this.getStatusText(state)}`);
    this.tray.setContextMenu(this.buildContextMenu(state));
  }

  /**
   * Destroys the tray icon and cleans up.
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  /**
   * Returns the filesystem path to the icon for the given state.
   */
  private getIconPath(state: RecordingState): string {
    // dist/main/main/ → ../../../assets/icons/
    const iconsDir = path.join(__dirname, '../../../assets/icons');

    // On macOS, template images handle dark/light automatically.
    // On Linux/Windows, use light (white) icons on dark themes.
    const useLightIcon = process.platform !== 'darwin' && nativeTheme.shouldUseDarkColors;
    const suffix = useLightIcon ? '-light' : '';

    switch (state.type) {
      case 'recording':
        return path.join(iconsDir, `tray-recording${suffix}.png`);
      case 'transcribing':
      case 'processing':
        return path.join(iconsDir, `tray-busy${suffix}.png`);
      case 'idle':
      case 'error':
      default:
        return path.join(iconsDir, `tray-idle${suffix}.png`);
    }
  }

  /**
   * Loads and returns a NativeImage for the given state.
   * On macOS, marks it as a template image for dark/light menu bar adaptation.
   */
  private loadIcon(state: RecordingState): NativeImage {
    const iconPath = this.getIconPath(state);
    const icon = nativeImage.createFromPath(iconPath);

    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }

    return icon;
  }

  /**
   * Returns a human-readable status string for the given state.
   */
  private getStatusText(state: RecordingState): string {
    switch (state.type) {
      case 'idle':
        return 'Idle';
      case 'recording':
        return 'Recording…';
      case 'transcribing':
        return 'Transcribing…';
      case 'processing':
        return 'Processing…';
      case 'error':
        return `Error: ${state.message}`;
      default:
        return 'Idle';
    }
  }

  /**
   * Builds a native context menu based on the current recording state.
   */
  private buildContextMenu(state: RecordingState): Menu {
    const isIdle = state.type === 'idle' || state.type === 'error';
    const isRecording = state.type === 'recording';

    return Menu.buildFromTemplate([
      {
        label: this.getStatusText(state),
        enabled: false,
      },
      { type: 'separator' },
      {
        label: isRecording ? 'Stop Recording' : 'Start Recording',
        enabled: isIdle || isRecording,
        click: () => {
          if (isRecording) {
            this.onStopRecording?.();
            return;
          }
          this.onStartRecording?.();
        },
      },
      { type: 'separator' },
      {
        label: 'History',
        click: () => {
          this.onShowHistory?.();
        },
      },
      {
        label: 'Settings',
        click: () => {
          this.onShowSettings?.();
        },
      },
      {
        label: 'Onboarding',
        click: () => {
          this.onShowOnboarding?.();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);
  }
}
