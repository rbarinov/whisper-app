import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { HOLD_THRESHOLD_MS, DOUBLE_PRESS_THRESHOLD_MS } from '../../src/shared/constants';
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

  const keyDown = (keyCode: number): void => {
    (manager as any).handleKeyDown(keyCode);
  };

  const keyUp = (keyCode: number): void => {
    (manager as any).handleKeyUp(keyCode);
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

  it('hold > 300ms emits holdStart then holdEnd', () => {
    keyDown(UiohookKey.F5);

    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);
    expect(actions).toEqual(['holdStart']);

    keyUp(UiohookKey.F5);
    expect(actions).toEqual(['holdStart', 'holdEnd']);
  });

  it('quick tap < 300ms emits no actions', () => {
    keyDown(UiohookKey.F5);
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS - 1);
    keyUp(UiohookKey.F5);

    expect(actions).toEqual([]);
  });

  it('double-press within 400ms emits toggleOn', () => {
    keyDown(UiohookKey.F5);
    keyUp(UiohookKey.F5);

    vi.advanceTimersByTime(100);

    keyDown(UiohookKey.F5);
    expect(actions).toEqual(['toggleOn']);

    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 20);
    expect(actions).toEqual(['toggleOn']);
  });

  it('toggle on then single press emits toggleOff', () => {
    keyDown(UiohookKey.F5);
    keyUp(UiohookKey.F5);
    vi.advanceTimersByTime(100);
    keyDown(UiohookKey.F5);
    keyUp(UiohookKey.F5);

    keyDown(UiohookKey.F5);

    expect(actions).toEqual(['toggleOn', 'toggleOff']);
  });

  it('escape during recording emits cancel', () => {
    manager.setRecordingState({ type: 'recording' });

    keyDown(UiohookKey.Escape);

    expect(actions).toEqual(['cancel']);
  });

  it('escape during idle emits nothing', () => {
    manager.setRecordingState({ type: 'idle' });

    keyDown(UiohookKey.Escape);

    expect(actions).toEqual([]);
  });

  it('auto-repeat keyDown is ignored when key is already down', () => {
    keyDown(UiohookKey.F5);
    keyDown(UiohookKey.F5);

    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);
    expect(actions).toEqual(['holdStart']);

    keyUp(UiohookKey.F5);
    expect(actions).toEqual(['holdStart', 'holdEnd']);
  });

  it('unrelated key is ignored', () => {
    keyDown(UiohookKey.F6);
    keyUp(UiohookKey.F6);
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 10);

    expect(actions).toEqual([]);
  });

  it('double-press after long gap does not emit toggleOn', () => {
    keyDown(UiohookKey.F5);
    keyUp(UiohookKey.F5);

    vi.advanceTimersByTime(DOUBLE_PRESS_THRESHOLD_MS + 10);

    keyDown(UiohookKey.F5);
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);
    expect(actions).toEqual(['holdStart']);

    keyUp(UiohookKey.F5);
    expect(actions).toEqual(['holdStart', 'holdEnd']);
  });
});
