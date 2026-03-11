import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron', () => ({
  clipboard: {
    writeText: vi.fn(),
    readText: vi.fn().mockReturnValue(''),
  },
}));

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
    cb(null);
  }),
}));

import {
  isWaylandSession,
  pasteText,
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
    it('writes text to clipboard and simulates keystroke', async () => {
      const clipboardWrite = vi.fn();
      const clipboardRead = vi.fn().mockReturnValue('');
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      const result = await pasteText('hello world', {
        clipboardWrite,
        clipboardRead,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
      });

      expect(clipboardWrite).toHaveBeenCalledWith('hello world');
      expect(simulateKeystroke).toHaveBeenCalled();
      expect(result.success).toBe(true);
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

    it('saves and restores previous clipboard contents', async () => {
      const clipboardWrite = vi.fn();
      const clipboardRead = vi.fn()
        .mockReturnValueOnce('previous content')  // first call: save previous clipboard
        .mockReturnValueOnce('new text');          // second call: restore check (clipboard still has our text)
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      await pasteText('new text', {
        clipboardWrite,
        clipboardRead,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
        restoreDelayMs: 10,
      });

      // First call: save previous clipboard (via clipboardRead)
      expect(clipboardRead).toHaveBeenCalled();
      // First clipboardWrite: set the new text
      expect(clipboardWrite).toHaveBeenCalledWith('new text');

      // Wait for clipboard restore timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      // clipboardRead is called again to check if our text is still there
      // clipboardWrite should be called again to restore
      expect(clipboardWrite).toHaveBeenCalledWith('previous content');
    });

    it('does not restore clipboard if user copied something else', async () => {
      const calls: string[] = [];
      const clipboardWrite = vi.fn((text: string) => calls.push(`write:${text}`));
      // First read returns previous content, second read returns something different
      const clipboardRead = vi.fn()
        .mockReturnValueOnce('previous content')
        .mockReturnValueOnce('user copied something new');
      const simulateKeystroke = vi.fn().mockResolvedValue(undefined);

      await pasteText('transcribed text', {
        clipboardWrite,
        clipboardRead,
        simulateKeystroke,
        isWayland: false,
        delayMs: 0,
        restoreDelayMs: 10,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should NOT restore because clipboard changed
      expect(clipboardWrite).toHaveBeenCalledTimes(1);
      expect(clipboardWrite).toHaveBeenCalledWith('transcribed text');
    });

    it('falls back to clipboard-only when keystroke simulation fails', async () => {
      const clipboardWrite = vi.fn();
      const clipboardRead = vi.fn().mockReturnValue('');
      const simulateKeystroke = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await pasteText('fail paste', {
        clipboardWrite,
        clipboardRead,
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
  });
});
