import { clipboard } from 'electron';

export interface PasteResult {
  success: boolean;
  method: 'keyboard' | 'clipboard-only';
  message?: string;
}

export interface KeyboardSimulator {
  pressKey(modifier: string, key: string): Promise<void>;
}

export function isWaylandSession(): boolean {
  return (
    process.env.XDG_SESSION_TYPE === 'wayland' ||
    !!process.env.WAYLAND_DISPLAY
  );
}

export function getPasteModifier(): string {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

function tryLoadNutJs(): KeyboardSimulator | null {
  try {
    // dynamic require — @nut-tree/nut-js is an optional peer dependency
    const { keyboard, Key } = require('@nut-tree/nut-js');
    return {
      async pressKey(modifier: string): Promise<void> {
        const modKey = modifier === 'Meta' ? Key.LeftSuper : Key.LeftControl;
        await keyboard.pressKey(modKey, Key.V);
        await keyboard.releaseKey(modKey, Key.V);
      },
    };
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PasteOptions {
  clipboardWrite?: (text: string) => void;
  keyboardSimulator?: KeyboardSimulator | null;
  isWayland?: boolean;
  delayMs?: number;
}

export async function pasteText(
  text: string,
  options: PasteOptions = {},
): Promise<PasteResult> {
  const {
    clipboardWrite = (t: string) => clipboard.writeText(t),
    keyboardSimulator,
    isWayland,
    delayMs = 50,
  } = options;

  clipboardWrite(text);

  const wayland = isWayland !== undefined ? isWayland : isWaylandSession();
  if (wayland) {
    return {
      success: true,
      method: 'clipboard-only',
      message: 'Text copied! Press Ctrl+V to paste',
    };
  }

  const simulator =
    keyboardSimulator !== undefined ? keyboardSimulator : tryLoadNutJs();

  if (!simulator) {
    return {
      success: true,
      method: 'clipboard-only',
      message: 'Text copied to clipboard (keyboard simulation unavailable)',
    };
  }

  try {
    await delay(delayMs);

    const modifier = getPasteModifier();
    await simulator.pressKey(modifier, 'V');

    return {
      success: true,
      method: 'keyboard',
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      success: true,
      method: 'clipboard-only',
      message: `Text copied to clipboard (paste simulation failed: ${errorMessage})`,
    };
  }
}
