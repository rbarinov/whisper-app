import {
  DEFAULT_CANCEL_KEY_CODE,
  DEFAULT_HOTKEY_KEY_CODE,
  DOUBLE_PRESS_THRESHOLD_MS,
  HOLD_THRESHOLD_MS,
} from '../../shared/constants';
import type { HotkeyAction, HotkeyModifiers, RecordingState } from '../../shared/types';
import { HotkeyBridge } from './hotkey-bridge';

type HotkeyActionCallback = (action: HotkeyAction) => void;
type RecordingStateType = RecordingState['type'];
type ModifierState = Required<HotkeyModifiers>;

const EMPTY_MODIFIERS: ModifierState = {
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
};

const MAC_MODIFIER_KEYS: Record<number, keyof ModifierState> = {
  54: 'meta',
  55: 'meta',
  56: 'shift',
  60: 'shift',
  58: 'alt',
  61: 'alt',
  59: 'ctrl',
  62: 'ctrl',
};

const UIOHOOK_MODIFIER_KEYS: Record<number, keyof ModifierState> = {
  29: 'ctrl',
  3613: 'ctrl',
  56: 'alt',
  3640: 'alt',
  42: 'shift',
  54: 'shift',
  3675: 'meta',
  3676: 'meta',
};

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
  private currentHotkeyModifiers: ModifierState = { ...EMPTY_MODIFIERS };
  private activeRecordingState: RecordingStateType = 'idle';

  private onAction: HotkeyActionCallback | null = null;

  private isStarted = false;
  private readonly bridge = IS_DARWIN && !IS_TEST_ENV ? new HotkeyBridge() : null;
  private cancelKeyModifiers: ModifierState = { ...EMPTY_MODIFIERS };
  private activeModifiers: ModifierState = { ...EMPTY_MODIFIERS };

  private readonly keyDownListener = (event: {
    keycode: number;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
  }) => {
    this.handleKeyDown(event.keycode, {
      ctrl: !!event.ctrlKey,
      alt: !!event.altKey,
      shift: !!event.shiftKey,
      meta: !!event.metaKey,
    });
  };
  private readonly keyUpListener = (event: {
    keycode: number;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
  }) => {
    this.handleKeyUp(event.keycode, {
      ctrl: !!event.ctrlKey,
      alt: !!event.altKey,
      shift: !!event.shiftKey,
      meta: !!event.metaKey,
    });
  };

  // Escape keyCode — macOS virtual (53) vs uiohook (1)
  private cancelKeyCode: number;

  constructor(
    initialHotkeyKeyCode: number = DEFAULT_HOTKEY_KEY_CODE,
    initialCancelKeyCode: number = DEFAULT_CANCEL_KEY_CODE,
    initialHotkeyModifiers?: HotkeyModifiers,
    initialCancelKeyModifiers?: HotkeyModifiers
  ) {
    this.currentKeyCode = initialHotkeyKeyCode;
    this.currentHotkeyModifiers = this.normalizeModifiers(initialHotkeyModifiers);
    this.cancelKeyModifiers = this.normalizeModifiers(initialCancelKeyModifiers);

    if (this.bridge) {
      // macOS: use native bridge, keyCodes are macOS virtual keyCodes
      this.cancelKeyCode = initialCancelKeyCode;

      this.bridge.onKeyDown((keyCode, modifiers) => {
        this.handleKeyDown(keyCode, modifiers);
      });

      this.bridge.onKeyUp((keyCode, modifiers) => {
        this.handleKeyUp(keyCode, modifiers);
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
      this.cancelKeyCode = IS_TEST_ENV ? 1 : getUiohook().UiohookKey.Escape;
    }
  }

  setActionCallback(callback: HotkeyActionCallback): void {
    this.onAction = callback;
  }

  setRecordingState(state: RecordingState): void {
    this.activeRecordingState = state.type;
  }

  setHotkey(keyCode: number, modifiers?: HotkeyModifiers): void {
    // keyCode from settings is always macOS virtual keyCode
    // On macOS bridge: use as-is
    // On uiohook: already mapped by settings service
    this.currentKeyCode = keyCode;
    this.currentHotkeyModifiers = this.normalizeModifiers(modifiers);

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

  setCancelKey(keyCode: number, modifiers?: HotkeyModifiers): void {
    this.cancelKeyCode = keyCode;
    this.cancelKeyModifiers = this.normalizeModifiers(modifiers);
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
    this.activeModifiers = { ...EMPTY_MODIFIERS };
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private emitAction(action: HotkeyAction): void {
    console.log(`[HotkeyManager] action: ${action} (state: ${this.activeRecordingState})`);
    this.onAction?.(action);
  }

  private handleKeyDown(keyCode: number, currentModifiers?: ModifierState): void {
    this.syncActiveModifiersFromEvent(currentModifiers);

    if (this.updateModifierKeyState(keyCode, true)) {
      return;
    }

    if (keyCode !== this.currentKeyCode && keyCode !== this.cancelKeyCode) {
      return;
    }

    const modifiers = currentModifiers ?? this.activeModifiers;

    if (keyCode === this.currentKeyCode) {
      if (!this.modifiersMatch(this.currentHotkeyModifiers, modifiers)) {
        return;
      }

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

    if (
      keyCode === this.cancelKeyCode &&
      this.activeRecordingState !== 'idle' &&
      this.modifiersMatch(this.cancelKeyModifiers, modifiers)
    ) {
      this.emitAction('cancel');
    }
  }

  private handleKeyUp(keyCode: number, currentModifiers?: ModifierState): void {
    this.syncActiveModifiersFromEvent(currentModifiers);

    if (this.updateModifierKeyState(keyCode, false)) {
      return;
    }

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
  }

  private normalizeModifiers(modifiers?: HotkeyModifiers): ModifierState {
    return {
      ctrl: !!modifiers?.ctrl,
      alt: !!modifiers?.alt,
      shift: !!modifiers?.shift,
      meta: !!modifiers?.meta,
    };
  }

  private modifiersMatch(required: ModifierState | undefined, current: ModifierState): boolean {
    if (!required) {
      return !current.ctrl && !current.alt && !current.shift && !current.meta;
    }

    return (
      !!required.ctrl === current.ctrl &&
      !!required.alt === current.alt &&
      !!required.shift === current.shift &&
      !!required.meta === current.meta
    );
  }

  private syncActiveModifiersFromEvent(modifiers?: ModifierState): void {
    if (!modifiers) {
      return;
    }

    this.activeModifiers = { ...modifiers };
  }

  private updateModifierKeyState(keyCode: number, isDown: boolean): boolean {
    const modifier = this.resolveModifierKey(keyCode);
    if (!modifier) {
      return false;
    }

    this.activeModifiers = {
      ...this.activeModifiers,
      [modifier]: isDown,
    };
    return true;
  }

  private resolveModifierKey(keyCode: number): keyof ModifierState | undefined {
    if (this.bridge) {
      return MAC_MODIFIER_KEYS[keyCode];
    }
    return UIOHOOK_MODIFIER_KEYS[keyCode];
  }
}
