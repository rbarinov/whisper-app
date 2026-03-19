import { clipboard, NativeImage } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LOG_FILE = path.join(os.homedir(), 'whisperapp-paste.log');

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
  console.log(message);
}
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

function resolveNativePasteHelperPath(): string | null {
  const devPath = path.resolve(__dirname, '../../../../native/paste-helper');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  const packagedPath = path.resolve(process.resourcesPath, 'native/paste-helper');
  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }

  return null;
}

/**
 * Simulate Cmd+V (macOS), Ctrl+V (Windows), or xdotool (Linux)
 * using only built-in OS tools — no native dependencies required.
 */
async function simulatePasteKeystroke(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      const helperPath = resolveNativePasteHelperPath();
      if (!helperPath) {
        reject(new Error('Native paste helper not found'));
        return;
      }
      log('[paste-service] Using native helper at: ' + helperPath);
      execFile(helperPath, (error, _stdout, stderr) => {
        if (error) {
          log('[paste-service] Native helper error: ' + error.message);
          reject(error);
        } else if (stderr) {
          log('[paste-service] Native helper stderr: ' + stderr);
          reject(new Error(stderr));
        } else {
          log('[paste-service] Native helper completed successfully');
          resolve();
        }
      });
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
    delayMs = process.platform === 'darwin' ? 120 : 50,
    restoreDelayMs = process.platform === 'darwin' ? 1200 : 500,
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

    log('[paste-service] Simulating paste keystroke, clipboard has: ' + (clipboardRead()?.substring(0, 50) || '(empty)'));
    await simulateKeystroke();
    log('[paste-service] Keystroke simulation complete');
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
