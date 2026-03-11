// Quick test: does uiohook-napi capture key events from inside Electron?
const { app } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');

app.on('ready', () => {
  console.log('[TEST] Electron ready. UiohookKey.F5 =', UiohookKey.F5);
  console.log('[TEST] Starting uiohook... Press ANY key within 15 seconds.');

  uIOhook.on('keydown', (e) => {
    console.log('[TEST] keydown:', e.keycode, e.keycode === UiohookKey.F5 ? '<<< F5!' : '');
  });
  uIOhook.on('keyup', (e) => {
    console.log('[TEST] keyup:', e.keycode);
  });

  uIOhook.start();

  setTimeout(() => {
    console.log('[TEST] 15s elapsed. Stopping.');
    uIOhook.stop();
    app.quit();
  }, 15000);
});

app.on('window-all-closed', (e) => e.preventDefault());
