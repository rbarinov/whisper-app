import {
  DEFAULT_HOTKEY_KEY_CODE,
  DOUBLE_PRESS_THRESHOLD_MS,
  HOLD_THRESHOLD_MS,
} from '../../shared/constants';
import type { HotkeyAction, RecordingState } from '../../shared/types';
import { HotkeyBridge } from './hotkey-bridge';

const MACOS_ESCAPE_KEY = 53; // macOS virtual keyCode for Escape

type HotkeyActionCallback = (action: HotkeyAction) => void;
type RecordingStateType = RecordingState['type'];

const IS_DARWIN = process.platform === 'darwin';
const IS_TEST_ENV =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  process.env.npm_lifecycle_event === 'test';

// Lazy-load uiohook-napi only on non-macOS to avoid dlopen signature issues
let _uIOhook: typeof import('uiohook-napi').uIOhook | null = null;
let _UiohookKey: typeof import('uiohook-napi').UiohookKey | null = null;

function getUiohook(): { uIOhook: typeof import('uiohook-napi').uIOhook; UiohookKey: typeof import('uiohook-napi').UiohookKey } {
  if (!_uIOhook || !_UiohookKey) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('uiohook-napi') as typeof import('uiohook-napi');
    _uIOhook = mod.uIOhook;
    _UiohookKey = mod.UiohookKey;
  }
  return { uIOhook: _uIOhook, UiohookKey: _UiohookKey };
}

export class HotkeyManager {
  private keyIsDown = false;
  private isToggleRecording = false;
  private lastKeyDownTime = 0;
  private holdTimer: NodeJS.Timeout | null = null;
  private currentKeyCode = DEFAULT_HOTKEY_KEY_CODE;
  private activeRecordingState: RecordingStateType = 'idle';

  private onAction: HotkeyActionCallback | null = null;

  private isStarted = false;
  private readonly bridge = IS_DARWIN && !IS_TEST_ENV ? new HotkeyBridge() : null;
  private readonly keyDownListener = (event: { keycode: number }) => {
    this.handleKeyDown(event.keycode);
  };
  private readonly keyUpListener = (event: { keycode: number }) => {
    this.handleKeyUp(event.keycode);
  };

  // Escape keyCode — macOS virtual (53) vs uiohook (1)
  private escapeKeyCode: number;

  constructor() {
    if (this.bridge) {
      // macOS: use native bridge, keyCodes are macOS virtual keyCodes
      this.escapeKeyCode = MACOS_ESCAPE_KEY;

      this.bridge.onKeyDown((keyCode) => {
        this.handleKeyDown(keyCode);
      });

      this.bridge.onKeyUp((keyCode) => {
        this.handleKeyUp(keyCode);
      });

      this.bridge.onMediaKey((_nxKeyType, isDown) => {
        if (isDown) {
          this.handleKeyDown(this.currentKeyCode);
        } else {
          this.handleKeyUp(this.currentKeyCode);
        }
      });
    } else {
      // Non-macOS: use uiohook, keyCodes are uiohook keyCodes
      // Map the default macOS virtual keyCode to uiohook
      this.escapeKeyCode = IS_TEST_ENV ? 1 : getUiohook().UiohookKey.Escape;
    }
  }

  setActionCallback(callback: HotkeyActionCallback): void {
    this.onAction = callback;
  }

  setRecordingState(state: RecordingState): void {
    this.activeRecordingState = state.type;
  }

  setHotkey(keyCode: number): void {
    // keyCode from settings is always macOS virtual keyCode
    // On macOS bridge: use as-is
    // On uiohook: already mapped by settings service
    this.currentKeyCode = keyCode;

    if (this.keyIsDown) {
      this.keyIsDown = false;
    }
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    if (this.isStarted) {
      if (this.bridge) {
        this.bridge.setKeyCode(keyCode);
      } else {
        this.stop();
        this.start();
      }
    }
  }

  start(): void {
    if (this.isStarted) {
      return;
    }

    if (this.bridge) {
      this.bridge.setKeyCode(this.currentKeyCode);
      this.bridge.start();
    } else if (!IS_TEST_ENV) {
      const { uIOhook } = getUiohook();
      uIOhook.on('keydown', this.keyDownListener);
      uIOhook.on('keyup', this.keyUpListener);
      uIOhook.start();
    }
    this.isStarted = true;
  }

  stop(): void {
    if (!this.isStarted) {
      return;
    }

    if (this.bridge) {
      this.bridge.stop();
    } else if (!IS_TEST_ENV) {
      const { uIOhook } = getUiohook();
      uIOhook.removeListener('keydown', this.keyDownListener);
      uIOhook.removeListener('keyup', this.keyUpListener);
      uIOhook.stop();
    }
    this.isStarted = false;

    this.keyIsDown = false;
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private emitAction(action: HotkeyAction): void {
    this.onAction?.(action);
  }

  private handleKeyDown(keyCode: number): void {
    if (keyCode !== this.currentKeyCode && keyCode !== this.escapeKeyCode) {
      return;
    }

    if (keyCode === this.currentKeyCode) {
      if (this.keyIsDown) {
        return;
      }

      this.keyIsDown = true;

      if (this.isToggleRecording) {
        this.emitAction('toggleOff');
        this.isToggleRecording = false;
        return;
      }

      const now = Date.now();
      const elapsed = now - this.lastKeyDownTime;

      if (elapsed < DOUBLE_PRESS_THRESHOLD_MS) {
        if (this.holdTimer) {
          clearTimeout(this.holdTimer);
          this.holdTimer = null;
        }
        this.isToggleRecording = true;
        this.emitAction('toggleOn');
      } else {
        if (this.holdTimer) {
          clearTimeout(this.holdTimer);
        }

        this.holdTimer = setTimeout(() => {
          if (!this.keyIsDown) {
            return;
          }
          this.holdTimer = null;
          this.emitAction('holdStart');
        }, HOLD_THRESHOLD_MS);
      }

      this.lastKeyDownTime = now;

      return;
    }

    if (keyCode === this.escapeKeyCode && this.activeRecordingState !== 'idle') {
      this.emitAction('cancel');
    }
  }

  private handleKeyUp(keyCode: number): void {
    if (keyCode !== this.currentKeyCode) {
      return;
    }

    if (!this.keyIsDown) {
      return;
    }

    this.keyIsDown = false;

    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    } else if (!this.isToggleRecording) {
      this.emitAction('holdEnd');
    }

    this.holdTimer = null;
  }
}
