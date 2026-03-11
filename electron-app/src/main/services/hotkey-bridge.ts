/**
 * Native macOS hotkey bridge.
 *
 * Uses an in-process CGEvent tap via the keytap N-API addon.
 * This runs inside the Electron process which has Accessibility permission,
 * avoiding the child-process permission inheritance issue.
 *
 * On other platforms: not used (HotkeyManager uses uiohook-napi directly).
 */

import * as path from 'path';
import * as fs from 'fs';

type KeytapEvent =
  | { type: 'keydown'; keyCode: number }
  | { type: 'keyup'; keyCode: number }
  | { type: 'media'; nxKeyType: number; isDown: boolean }
  | { type: 'ready' }
  | { type: 'error'; message: string };

type KeyCallback = (keyCode: number) => void;
type MediaCallback = (nxKeyType: number, isDown: boolean) => void;

const F_KEY_TO_NX_KEY_TYPE: Record<number, number> = {
  // F3
  160: 10,  // Apple Silicon
  99: 10,   // traditional (kVK_F3)
  // F4
  177: 131, // Apple Silicon
  118: 131, // traditional (kVK_F4)
  // F5
  176: 22,  // Apple Silicon — NX_KEYTYPE_ILLUMINATION_DOWN
  96: 22,   // traditional (kVK_F5)
  // F6
  178: 23,  // Apple Silicon — NX_KEYTYPE_ILLUMINATION_UP
  97: 23,   // traditional (kVK_F6)
  // F7–F12
  98: 20,   // F7 — Rewind
  100: 16,  // F8 — Play/Pause
  101: 19,  // F9 — Fast Forward
  109: 7,   // F10 — Mute
  103: 1,   // F11 — Volume Down
  111: 0,   // F12 — Volume Up
};

export function fKeyToNXKeyType(keyCode: number): number | undefined {
  return F_KEY_TO_NX_KEY_TYPE[keyCode];
}

interface KeytapAddon {
  start(callback: (event: KeytapEvent) => void): void;
  stop(): void;
  setTargetKey(keyCode: number, nxKeyType: number): void;
}

function loadKeytapAddon(): KeytapAddon | null {
  // Try dev path first: native/keytap/build/Release/keytap.node
  // __dirname at runtime = dist/main/main/services/
  const devPath = path.resolve(__dirname, '../../../../native/keytap/build/Release/keytap.node');
  if (fs.existsSync(devPath)) {
    try {
      return require(devPath) as KeytapAddon;
    } catch (err) {
      console.error('[HotkeyBridge] Failed to load keytap addon from dev path:', err);
    }
  }

  // Try packaged path
  const packagedPath = path.resolve(process.resourcesPath, 'native/keytap.node');
  if (fs.existsSync(packagedPath)) {
    try {
      return require(packagedPath) as KeytapAddon;
    } catch (err) {
      console.error('[HotkeyBridge] Failed to load keytap addon from packaged path:', err);
    }
  }

  console.error(`[HotkeyBridge] keytap.node not found at ${devPath} or ${packagedPath}`);
  return null;
}

export class HotkeyBridge {
  private addon: KeytapAddon | null = null;
  private running = false;
  private currentKeyCode = 176;
  private keyDownCallback: KeyCallback | null = null;
  private keyUpCallback: KeyCallback | null = null;
  private mediaCallback: MediaCallback | null = null;

  start(): void {
    if (process.platform !== 'darwin' || this.running) {
      return;
    }

    this.addon = loadKeytapAddon();
    if (!this.addon) {
      console.error('[HotkeyBridge] Cannot start — keytap addon not available');
      return;
    }

    this.addon.start((event: KeytapEvent) => {
      this.handleEvent(event);
    });

    // Set the target key to consume immediately
    const nxType = fKeyToNXKeyType(this.currentKeyCode);
    this.addon.setTargetKey(this.currentKeyCode, nxType ?? -1);

    this.running = true;
  }

  stop(): void {
    if (!this.running || !this.addon) {
      return;
    }

    this.addon.stop();
    this.addon = null;
    this.running = false;
  }

  setKeyCode(code: number): void {
    this.currentKeyCode = code;
    // Tell the native addon which key to consume (block propagation)
    if (this.addon) {
      const nxType = fKeyToNXKeyType(code);
      this.addon.setTargetKey(code, nxType ?? -1);
    }
  }

  onKeyDown(callback: KeyCallback): void {
    this.keyDownCallback = callback;
  }

  onKeyUp(callback: KeyCallback): void {
    this.keyUpCallback = callback;
  }

  onMediaKey(callback: MediaCallback): void {
    this.mediaCallback = callback;
  }

  private handleEvent(event: KeytapEvent): void {
    if (event.type === 'ready') {
      return;
    }

    if (event.type === 'error') {
      console.error(`[HotkeyBridge] ${event.message}`);
      return;
    }

    if (event.type === 'keydown') {
      this.keyDownCallback?.(event.keyCode);
      return;
    }

    if (event.type === 'keyup') {
      this.keyUpCallback?.(event.keyCode);
      return;
    }

    // Media key event — only forward if it matches our target key
    const expectedNXType = fKeyToNXKeyType(this.currentKeyCode);
    if (expectedNXType === undefined || event.nxKeyType !== expectedNXType) {
      return;
    }

    this.mediaCallback?.(event.nxKeyType, event.isDown);
  }
}
