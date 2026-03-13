import { clipboard, NativeImage } from 'electron';
import { execFile } from 'child_process';

export interface PasteResult {
  success: boolean;
  method: 'keyboard' | 'clipboard-only';
  message?: string;
}

export function isWaylandSession(): boolean {
  return (
    process.env.XDG_SESSION_TYPE === 'wayland' ||
    !!process.env.WAYLAND_DISPLAY
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulate Cmd+V (macOS), Ctrl+V (Windows), or xdotool (Linux)
 * using only built-in OS tools — no native dependencies required.
 */
async function simulatePasteKeystroke(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      // AppleScript: simulate Cmd+V keystroke in the frontmost application
      execFile(
        'osascript',
        ['-e', 'tell application "System Events" to keystroke "v" using command down'],
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
    } else if (process.platform === 'win32') {
      // PowerShell: simulate Ctrl+V
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")',
        ],
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
    } else {
      // Linux X11: use xdotool to simulate Ctrl+V
      execFile('xdotool', ['key', 'ctrl+v'], (error) => {
        if (error) reject(error);
        else resolve();
      });
    }
  });
}

/** Snapshot of all clipboard formats for save/restore. */
export interface ClipboardSnapshot {
  text: string;
  html: string;
  rtf: string;
  image: NativeImage | null;
  formats: string[];
}

/**
 * Save all clipboard formats into a snapshot.
 * Captures text, HTML, RTF, and image data so nothing is lost.
 */
export function saveClipboard(): ClipboardSnapshot {
  const formats = clipboard.availableFormats();
  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: formats.some(f => f.startsWith('image/')) ? clipboard.readImage() : null,
    formats,
  };
}

/**
 * Restore clipboard from a previously saved snapshot.
 * Uses clipboard.write() to set all formats atomically.
 */
export function restoreClipboard(snapshot: ClipboardSnapshot): void {
  // If clipboard was empty, just clear it
  if (snapshot.formats.length === 0) {
    clipboard.clear();
    return;
  }

  const writeData: Electron.Data = {};

  if (snapshot.text) {
    writeData.text = snapshot.text;
  }
  if (snapshot.html) {
    writeData.html = snapshot.html;
  }
  if (snapshot.rtf) {
    writeData.rtf = snapshot.rtf;
  }
  if (snapshot.image && !snapshot.image.isEmpty()) {
    writeData.image = snapshot.image;
  }

  // If we captured formats but none of the above were populated,
  // the clipboard had custom/unknown format — clear to avoid stale data
  if (Object.keys(writeData).length === 0) {
    clipboard.clear();
    return;
  }

  clipboard.write(writeData);
}

export interface PasteOptions {
  delayMs?: number;
  restoreDelayMs?: number;
  isWayland?: boolean;
  /** Override clipboard write for testing */
  clipboardWrite?: (text: string) => void;
  /** Override clipboard read for testing */
  clipboardRead?: () => string;
  /** Override clipboard save for testing */
  clipboardSave?: () => ClipboardSnapshot;
  /** Override clipboard restore for testing */
  clipboardRestore?: (snapshot: ClipboardSnapshot) => void;
  /** Override keystroke simulation for testing */
  simulateKeystroke?: () => Promise<void>;
}

/**
 * Paste text into the active application.
 *
 * Flow (mirrors native Swift PasteService):
 *   1. Save current clipboard contents
 *   2. Write transcribed text to clipboard
 *   3. Wait briefly (50ms) for clipboard to settle
 *   4. Simulate Cmd+V / Ctrl+V keystroke
 *   5. Wait briefly (150ms) for target app to read clipboard
 *   6. Restore previous clipboard contents
 */
export async function pasteText(
  text: string,
  options: PasteOptions = {},
): Promise<PasteResult> {
  const {
    delayMs = 50,
    restoreDelayMs = 500,
    clipboardWrite = (t: string) => clipboard.writeText(t),
    clipboardRead = () => clipboard.readText(),
    clipboardSave = saveClipboard,
    clipboardRestore = restoreClipboard,
    simulateKeystroke = simulatePasteKeystroke,
    isWayland,
  } = options;

  // On Wayland, keyboard simulation doesn't work — clipboard-only fallback
  const wayland = isWayland !== undefined ? isWayland : isWaylandSession();
  if (wayland) {
    clipboardWrite(text);
    return {
      success: true,
      method: 'clipboard-only',
      message: 'Text copied! Press Ctrl+V to paste',
    };
  }

  // 1. Save ALL clipboard formats (text, HTML, RTF, image)
  const previousSnapshot = clipboardSave();

  // 2. Write transcribed text to clipboard
  clipboardWrite(text);

  try {
    // 3. Small delay before simulating keystroke (let clipboard settle)
    await delay(delayMs);

    // 4. Simulate paste keystroke
    await simulateKeystroke();

    // 5. Restore previous clipboard after target app reads it
    setTimeout(() => {
      try {
        // Only restore if clipboard still contains our text
        // (user may have copied something else in the meantime)
        if (clipboardRead() === text && previousSnapshot.text !== text) {
          clipboardRestore(previousSnapshot);
        }
      } catch {
        // Clipboard restore is best-effort
      }
    }, restoreDelayMs);

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
