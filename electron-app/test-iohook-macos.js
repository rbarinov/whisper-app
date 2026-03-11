const { app } = require('electron');
const { IOHook } = require('iohook-macos');

app.on('ready', () => {
  console.log('[TEST] Electron ready. Starting iohook-macos...');
  console.log('[TEST] Press F5, Escape, or any key within 15 seconds.');

  const hook = new IOHook();

  hook.on('keydown', (event) => {
    console.log('[TEST] keydown:', JSON.stringify(event));
  });
  hook.on('keyup', (event) => {
    console.log('[TEST] keyup:', JSON.stringify(event));
  });

  hook.start();

  setTimeout(() => {
    console.log('[TEST] 15s elapsed. Stopping.');
    hook.stop();
    app.quit();
  }, 15000);
});

app.on('window-all-closed', (e) => e.preventDefault());
