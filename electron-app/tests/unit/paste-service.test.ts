import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron', () => ({
  clipboard: {
    writeText: vi.fn(),
    readText: vi.fn().mockReturnValue(''),
    readHTML: vi.fn().mockReturnValue(''),
    readRTF: vi.fn().mockReturnValue(''),
    readImage: vi.fn().mockReturnValue({ isEmpty: () => true }),
    availableFormats: vi.fn().mockReturnValue([]),
    write: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  execFile: vi.fn((cmd: string, argsOrCb: string[] | ((err: Error | null) => void), maybeCb?: (err: Error | null) => void) => {
    const cb = typeof argsOrCb === 'function' ? argsOrCb : maybeCb;
    if (typeof cb === 'function') {
      cb(null);
    }
  }),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn((targetPath: string) => /native[\\/]paste-helper$/.test(targetPath)),
}));

import {
  isWaylandSession,
  pasteText,
  type ClipboardSnapshot,
} from '../../src/main/services/paste-service';

describe('Paste Service', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.XDG_SESSION_TYPE;
    delete process.env.WAYLAND_DISPLAY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  describe('isWaylandSession', () => {
    it('returns false when XDG_SESSION_TYPE is not wayland and WAYLAND_DISPLAY is not set', () => {
      process.env.XDG_SESSION_TYPE = 'x11';
      expect(isWaylandSession()).toBe(false);
    });

    it('returns false when neither env var is set', () => {
      expect(isWaylandSession()).toBe(false);
    });

    it('returns true when XDG_SESSION_TYPE is wayland', () => {
      process.env.XDG_SESSION_TYPE = 'wayland';
      expect(isWaylandSession()).toBe(true);
    });

    it('returns true when WAYLAND_DISPLAY is set', () => {
      process.env.WAYLAND_DISPLAY = 'wayland-0';
      expect(isWaylandSession()).toBe(true);
    });

    it('returns true when both XDG_SESSION_TYPE and WAYLAND_DISPLAY are set', () => {
      process.env.XDG_SESSION_TYPE = 'wayland';
      process.env.WAYLAND_DISPLAY = 'wayland-0';
      expect(isWaylandSession()).toBe(true);
    });
  });

  describe('pasteText', () => {
    const emptySnapshot: ClipboardSnapshot = {
      text: '',
      html: '',
      rtf: '',
      image: null,
      formats: [],
    };

    it('writes text to clipboard and simulates keystroke', async () => {
      const clipboardWrite = vi.fn();
      const clipboardRead = vi.fn().mockReturnValue('');
      const clipboardSave = vi.fn().mockReturnValue(emptySnapshot);
      const clipboardRestore = vi.fn();
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      const result = await pasteText('hello world', {
        clipboardWrite,
        clipboardRead,
        clipboardSave,
        clipboardRestore,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
      });

      expect(clipboardSave).toHaveBeenCalled();
      expect(clipboardWrite).toHaveBeenCalledWith('hello world');
      expect(simulateKeystroke).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.method).toBe('keyboard');
    });

    it('uses the native paste helper on macOS', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const { execFile } = await import('child_process');

      const result = await pasteText('native helper', {
        clipboardWrite: vi.fn(),
        clipboardRead: vi.fn().mockReturnValue(''),
        clipboardSave: vi.fn().mockReturnValue(emptySnapshot),
        isWayland: false,
        delayMs: 0,
      });

      expect(execFile).toHaveBeenCalled();
      expect(result.method).toBe('keyboard');
    });

    it('returns clipboard-only result on Wayland with user-facing message', async () => {
      const clipboardWrite = vi.fn();
      const result = await pasteText('wayland text', {
        clipboardWrite,
        isWayland: true,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard-only');
      expect(result.message).toContain('Ctrl+V');
      expect(clipboardWrite).toHaveBeenCalledWith('wayland text');
    });

    it('saves and restores previous clipboard contents (all formats)', async () => {
      const previousSnapshot: ClipboardSnapshot = {
        text: 'previous text',
        html: '<b>previous</b>',
        rtf: '{\\rtf1 previous}',
        image: null,
        formats: ['text/plain', 'text/html', 'text/rtf'],
      };
      const clipboardWrite = vi.fn();
      const clipboardRead = vi.fn().mockReturnValue('new text');
      const clipboardSave = vi.fn().mockReturnValue(previousSnapshot);
      const clipboardRestore = vi.fn();
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      await pasteText('new text', {
        clipboardWrite,
        clipboardRead,
        clipboardSave,
        clipboardRestore,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
        restoreDelayMs: 10,
      });

      expect(clipboardSave).toHaveBeenCalled();
      expect(clipboardWrite).toHaveBeenCalledWith('new text');

      // Wait for clipboard restore timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      // clipboardRestore should be called with full snapshot
      expect(clipboardRestore).toHaveBeenCalledWith(previousSnapshot);
    });

    it('does not restore clipboard if user copied something else', async () => {
      const previousSnapshot: ClipboardSnapshot = {
        text: 'previous content',
        html: '',
        rtf: '',
        image: null,
        formats: ['text/plain'],
      };
      const clipboardWrite = vi.fn();
      // clipboardRead returns something different from what we pasted
      const clipboardRead = vi.fn().mockReturnValue('user copied something new');
      const clipboardSave = vi.fn().mockReturnValue(previousSnapshot);
      const clipboardRestore = vi.fn();
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      await pasteText('transcribed text', {
        clipboardWrite,
        clipboardRead,
        clipboardSave,
        clipboardRestore,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
        restoreDelayMs: 10,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should NOT restore because clipboard changed
      expect(clipboardRestore).not.toHaveBeenCalled();
    });

    it('falls back to clipboard-only when keystroke simulation fails', async () => {
      const clipboardWrite = vi.fn();
      const clipboardRead = vi.fn().mockReturnValue('');
      const clipboardSave = vi.fn().mockReturnValue(emptySnapshot);
      const simulateKeystroke = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await pasteText('fail paste', {
        clipboardWrite,
        clipboardRead,
        clipboardSave,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard-only');
      expect(result.message).toContain('Permission denied');
    });

    it('applies delay before keyboard simulation', async () => {
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      const start = Date.now();
      await pasteText('delayed paste', {
        clipboardWrite: vi.fn(),
        clipboardRead: vi.fn().mockReturnValue(''),
        clipboardSave: vi.fn().mockReturnValue(emptySnapshot),
        simulateKeystroke,
        isWayland: false,
        delayMs: 100,
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(simulateKeystroke).toHaveBeenCalled();
    });

    it('skips keyboard simulation on Wayland even when simulateKeystroke is provided', async () => {
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      const result = await pasteText('wayland skip', {
        clipboardWrite: vi.fn(),
        simulateKeystroke,
        isWayland: true,
      });

      expect(result.method).toBe('clipboard-only');
      expect(simulateKeystroke).not.toHaveBeenCalled();
    });

    it('saves and restores clipboard with image data', async () => {
      const mockImage = { isEmpty: () => false } as unknown as import('electron').NativeImage;
      const previousSnapshot: ClipboardSnapshot = {
        text: '',
        html: '',
        rtf: '',
        image: mockImage,
        formats: ['image/png'],
      };
      const clipboardWrite = vi.fn();
      const clipboardRead = vi.fn().mockReturnValue('transcribed');
      const clipboardSave = vi.fn().mockReturnValue(previousSnapshot);
      const clipboardRestore = vi.fn();
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      await pasteText('transcribed', {
        clipboardWrite,
        clipboardRead,
        clipboardSave,
        clipboardRestore,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
        restoreDelayMs: 10,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should restore the image snapshot
      expect(clipboardRestore).toHaveBeenCalledWith(previousSnapshot);
    });

    it('does not restore if previous text was the same as pasted text', async () => {
      const previousSnapshot: ClipboardSnapshot = {
        text: 'same text',
        html: '',
        rtf: '',
        image: null,
        formats: ['text/plain'],
      };
      const clipboardWrite = vi.fn();
      const clipboardRead = vi.fn().mockReturnValue('same text');
      const clipboardSave = vi.fn().mockReturnValue(previousSnapshot);
      const clipboardRestore = vi.fn();
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      await pasteText('same text', {
        clipboardWrite,
        clipboardRead,
        clipboardSave,
        clipboardRestore,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
        restoreDelayMs: 10,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should NOT restore — previous text was same as pasted, no point restoring
      expect(clipboardRestore).not.toHaveBeenCalled();
    });
  });
});
