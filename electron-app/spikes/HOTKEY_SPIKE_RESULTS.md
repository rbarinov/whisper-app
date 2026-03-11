# Hotkey Spike Results (`uiohook-napi`)

Date: 2026-03-11  
Platform: macOS ARM64  
Package: `uiohook-napi@1.5.4`

## What was implemented

- Standalone spike script: `spikes/hotkey-spike.ts`
- CommonJS import (`require('uiohook-napi')`) for direct Node runtime usage
- Event logging for every `keydown` / `keyup` with keycode + timestamps
- Hold duration calculation (`keydown` → `keyup`) with 300ms threshold
- Double-press detection with 400ms threshold
- Auto-repeat filtering via currently-pressed key tracking
- Escape detection to stop early
- Auto-exit after 30 seconds

## Keycode findings

From installed `uiohook-napi` types (`node_modules/uiohook-napi/dist/index.d.ts`):

- `UiohookKey.F5 = 63`
- `UiohookKey.Escape = 1`

Recommendation for `src/shared/constants.ts`:

- `DEFAULT_HOTKEY_KEY_CODE = 63`

Status: applied.

## Behavior validation

### 1) keyDown / keyUp reliability

- API surfaces separate events (`'keydown'` and `'keyup'`) in `UiohookNapi.on(...)`.
- Internally, event type mapping is explicit in `dist/index.js`:
  - `EVENT_KEY_PRESSED (4)` → `'keydown'`
  - `EVENT_KEY_RELEASED (5)` → `'keyup'`
- Runtime interactive validation in this environment was blocked by macOS accessibility permissions.

### 2) Hold detection support

- Supported: spike measures duration between `keydown` and `keyup` and marks hold using 300ms.
- This matches Swift thresholds (`holdThreshold = 0.3s`).

### 3) Double-press detection support

- Supported: spike tracks last press timestamp and flags second press within 400ms.
- This matches Swift thresholds (`doublePressThreshold = 0.4s`).

### 4) Auto-repeat behavior

- `uiohook-napi` keyboard event type does not expose an `isAutoRepeat` flag.
- Practical strategy used in spike: ignore repeated `keydown` for keys already marked as down.
- This mirrors robust state-machine behavior needed for hold/toggle logic.

### 5) Events while app is not focused

- Expected: yes (global hook library by design).
- Runtime confirmation not possible in this run due missing accessibility permission.

## Runtime result from this machine

Command run:

```bash
node spikes/hotkey-spike.ts
```

Observed output:

```text
[2026-03-10T21:53:03.422Z] Starting uiohook hotkey spike
[2026-03-10T21:53:03.438Z] Reference keycodes: F5=63, Escape=1, hold=300ms, doublePress=400ms
hook_run [1405]: Accessibility API is disabled!
```

## Issues found

- macOS accessibility permission is mandatory for live keyboard hook operation.
- Without Accessibility enabled, listener startup fails before meaningful key event testing.

## Conclusion

- `uiohook-napi` API shape supports all required primitives for Task 7 hotkey state machine:
  - distinct keydown/keyup events
  - hold timing window
  - double-press timing window
  - repeat filtering at app layer
- Use `63` as F5 keycode constant in Electron shared constants.
