import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron', () => ({
  clipboard: {
    writeText: vi.fn(),
  },
}));

import { clipboard } from 'electron';
import {
  isWaylandSession,
  getPasteModifier,
  pasteText,
} from '../../src/main/services/paste-service';
import type { KeyboardSimulator } from '../../src/main/services/paste-service';

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

  describe('getPasteModifier', () => {
    it('returns Meta on darwin', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(getPasteModifier()).toBe('Meta');
    });

    it('returns Control on linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(getPasteModifier()).toBe('Control');
    });

    it('returns Control on win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(getPasteModifier()).toBe('Control');
    });
  });

  describe('pasteText', () => {
    it('writes text to clipboard', async () => {
      const clipboardWrite = vi.fn();
      await pasteText('hello world', {
        clipboardWrite,
        keyboardSimulator: null,
        isWayland: false,
      });

      expect(clipboardWrite).toHaveBeenCalledWith('hello world');
    });

    it('uses electron clipboard.writeText by default when no clipboardWrite provided', async () => {
      await pasteText('test text', {
        keyboardSimulator: null,
        isWayland: false,
      });

      expect(clipboard.writeText).toHaveBeenCalledWith('test text');
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

    it('returns clipboard-only when simulator is null (nut-js unavailable)', async () => {
      const clipboardWrite = vi.fn();
      const result = await pasteText('no simulator', {
        clipboardWrite,
        keyboardSimulator: null,
        isWayland: false,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard-only');
      expect(result.message).toContain('keyboard simulation unavailable');
    });

    it('uses Meta+V modifier on macOS (non-Wayland)', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const mockSimulator: KeyboardSimulator = {
        pressKey: vi.fn().mockResolvedValue(undefined),
      };

      const result = await pasteText('mac paste', {
        clipboardWrite: vi.fn(),
        keyboardSimulator: mockSimulator,
        isWayland: false,
        delayMs: 0,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('keyboard');
      expect(mockSimulator.pressKey).toHaveBeenCalledWith('Meta', 'V');
    });

    it('uses Control+V modifier on Windows (non-Wayland)', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const mockSimulator: KeyboardSimulator = {
        pressKey: vi.fn().mockResolvedValue(undefined),
      };

      const result = await pasteText('win paste', {
        clipboardWrite: vi.fn(),
        keyboardSimulator: mockSimulator,
        isWayland: false,
        delayMs: 0,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('keyboard');
      expect(mockSimulator.pressKey).toHaveBeenCalledWith('Control', 'V');
    });

    it('uses Control+V modifier on Linux (non-Wayland)', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const mockSimulator: KeyboardSimulator = {
        pressKey: vi.fn().mockResolvedValue(undefined),
      };

      const result = await pasteText('linux paste', {
        clipboardWrite: vi.fn(),
        keyboardSimulator: mockSimulator,
        isWayland: false,
        delayMs: 0,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('keyboard');
      expect(mockSimulator.pressKey).toHaveBeenCalledWith('Control', 'V');
    });

    it('falls back to clipboard-only when simulator throws', async () => {
      const mockSimulator: KeyboardSimulator = {
        pressKey: vi.fn().mockRejectedValue(new Error('Permission denied')),
      };

      const result = await pasteText('fail paste', {
        clipboardWrite: vi.fn(),
        keyboardSimulator: mockSimulator,
        isWayland: false,
        delayMs: 0,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard-only');
      expect(result.message).toContain('Permission denied');
    });

    it('applies delay before keyboard simulation', async () => {
      const mockSimulator: KeyboardSimulator = {
        pressKey: vi.fn().mockResolvedValue(undefined),
      };

      const start = Date.now();
      await pasteText('delayed paste', {
        clipboardWrite: vi.fn(),
        keyboardSimulator: mockSimulator,
        isWayland: false,
        delayMs: 100,
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(mockSimulator.pressKey).toHaveBeenCalled();
    });

    it('skips keyboard simulation on Wayland even when simulator is provided', async () => {
      const mockSimulator: KeyboardSimulator = {
        pressKey: vi.fn().mockResolvedValue(undefined),
      };

      const result = await pasteText('wayland skip', {
        clipboardWrite: vi.fn(),
        keyboardSimulator: mockSimulator,
        isWayland: true,
      });

      expect(result.method).toBe('clipboard-only');
      expect(mockSimulator.pressKey).not.toHaveBeenCalled();
    });
  });
});
