const nodeRequire: NodeJS.Require = require;
const uiohookNapi: typeof import('uiohook-napi') = nodeRequire('uiohook-napi');
const { uIOhook, UiohookKey } = uiohookNapi;

const HOLD_THRESHOLD_MS = 300;
const DOUBLE_PRESS_THRESHOLD_MS = 400;
const RUN_DURATION_MS = 30_000;

const pressedKeys = new Set();
const keyDownAt = new Map();
const lastPressAt = new Map();

const now = () => Date.now();
const fmt = (ts: number): string => new Date(ts).toISOString();

function log(message: string): void {
  console.log(`[${fmt(now())}] ${message}`);
}

function stopAndExit(code = 0) {
  try {
    uIOhook.stop();
  } catch (error) {
    const err = error;
    log(`uIOhook.stop() failed: ${err && err.message ? err.message : String(err)}`);
  }
  process.exit(code);
}

log('Starting uiohook hotkey spike');
log(
  `Reference keycodes: F5=${UiohookKey.F5}, Escape=${UiohookKey.Escape}, hold=${HOLD_THRESHOLD_MS}ms, doublePress=${DOUBLE_PRESS_THRESHOLD_MS}ms`
);

uIOhook.on('keydown', (event: { keycode: number; time: number }) => {
  const ts = now();
  const keycode = event.keycode;

  log(`keyDown keycode=${keycode} eventTime=${event.time}`);

  if (keycode === UiohookKey.Escape) {
    log('Escape detected -> stopping spike early');
    stopAndExit(0);
    return;
  }

  if (pressedKeys.has(keycode)) {
    log(`autoRepeat filtered keycode=${keycode}`);
    return;
  }

  pressedKeys.add(keycode);
  keyDownAt.set(keycode, ts);

  const previousPress = lastPressAt.get(keycode);
  if (typeof previousPress === 'number') {
    const delta = ts - previousPress;
    if (delta <= DOUBLE_PRESS_THRESHOLD_MS) {
      log(`doublePress detected keycode=${keycode} deltaMs=${delta}`);
    }
  }
  lastPressAt.set(keycode, ts);
});

uIOhook.on('keyup', (event: { keycode: number; time: number }) => {
  const ts = now();
  const keycode = event.keycode;

  log(`keyUp keycode=${keycode} eventTime=${event.time}`);

  pressedKeys.delete(keycode);

  const started = keyDownAt.get(keycode);
  if (typeof started === 'number') {
    const holdDurationMs = ts - started;
    const isHold = holdDurationMs >= HOLD_THRESHOLD_MS;
    log(
      `holdDuration keycode=${keycode} durationMs=${holdDurationMs} isHold=${isHold}`
    );
    keyDownAt.delete(keycode);
  }
});

process.on('SIGINT', () => {
  log('SIGINT received -> stopping spike');
  stopAndExit(0);
});

setTimeout(() => {
  log(`Run duration reached (${RUN_DURATION_MS}ms) -> exiting`);
  stopAndExit(0);
}, RUN_DURATION_MS);

uIOhook.start();
log('uIOhook listener started. Press keys (including F5) for 30 seconds.');
