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


  it('quick tap < 300ms emits no actions', () => {
    keyDown(UiohookKey.F5);
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS - 1);
    keyUp(UiohookKey.F5);

    expect(actions).toEqual([]);
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


  it('unrelated key is ignored', () => {
    keyDown(UiohookKey.F6);
    keyUp(UiohookKey.F6);
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 10);

    expect(actions).toEqual([]);
  });

});
