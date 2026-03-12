import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { HOLD_THRESHOLD_MS } from '../../src/shared/constants';
import type { HotkeyAction } from '../../src/shared/types';
import { HotkeyManager } from '../../src/main/services/hotkey-manager';
import { UiohookKey } from 'uiohook-napi';

vi.mock('uiohook-napi', () => ({
  UiohookKey: {
    F5: 63,
    Escape: 1,
  },
  uIOhook: {
    on: vi.fn(),
    removeListener: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

describe('HotkeyManager state machine', () => {
  let manager: HotkeyManager;
  let actions: HotkeyAction[];

  const keyDown = (
    keyCode: number,
    modifiers?: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }
  ): void => {
    (manager as any).handleKeyDown(keyCode, {
      ctrl: !!modifiers?.ctrl,
      alt: !!modifiers?.alt,
      shift: !!modifiers?.shift,
      meta: !!modifiers?.meta,
    });
  };

  const keyUp = (
    keyCode: number,
    modifiers?: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }
  ): void => {
    (manager as any).handleKeyUp(keyCode, {
      ctrl: !!modifiers?.ctrl,
      alt: !!modifiers?.alt,
      shift: !!modifiers?.shift,
      meta: !!modifiers?.meta,
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T00:00:00.000Z'));

    manager = new HotkeyManager();
    actions = [];
    manager.setActionCallback((action) => {
      actions.push(action);
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });


  it('quick tap < 300ms emits no actions', () => {
    keyDown(UiohookKey.F5);
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS - 1);
    keyUp(UiohookKey.F5);

    expect(actions).toEqual([]);
  });

  it('hotkey with required modifiers only triggers when modifiers match', () => {
    manager.setHotkey(UiohookKey.F5, { ctrl: true, shift: true });

    keyDown(UiohookKey.F5, { ctrl: true, shift: true });
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 1);
    keyUp(UiohookKey.F5, { ctrl: true, shift: true });

    expect(actions).toEqual(['holdStart', 'holdEnd']);
  });

  it('hotkey with required modifiers does not trigger on mismatched modifiers', () => {
    manager.setHotkey(UiohookKey.F5, { ctrl: true, shift: true });

    keyDown(UiohookKey.F5, { ctrl: true });
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 1);
    keyUp(UiohookKey.F5, { ctrl: true });

    expect(actions).toEqual([]);
  });

  it('hotkey without modifiers requires no active modifiers', () => {
    manager.setHotkey(UiohookKey.F5, undefined);

    keyDown(UiohookKey.F5, { shift: true });
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 1);
    keyUp(UiohookKey.F5, { shift: true });

    expect(actions).toEqual([]);
  });

  it('escape during recording emits cancel', () => {
    manager.setRecordingState({ type: 'recording' });

    keyDown(UiohookKey.Escape);

    expect(actions).toEqual(['cancel']);
  });

  it('cancel key with modifiers only triggers when modifiers match', () => {
    manager.setRecordingState({ type: 'recording' });
    manager.setCancelKey(UiohookKey.Escape, { alt: true });

    keyDown(UiohookKey.Escape, { alt: false });
    keyDown(UiohookKey.Escape, { alt: true });

    expect(actions).toEqual(['cancel']);
  });

  it('escape during idle emits nothing', () => {
    manager.setRecordingState({ type: 'idle' });

    keyDown(UiohookKey.Escape);

    expect(actions).toEqual([]);
  });


  it('unrelated key is ignored', () => {
    keyDown(64);
    keyUp(64);
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 10);

    expect(actions).toEqual([]);
  });

});
