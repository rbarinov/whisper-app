const { app, globalShortcut, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  // Create a window so we can see the app is running
  const win = new BrowserWindow({ width: 400, height: 200 });
  win.loadURL('data:text/html,<h2>WhisperApp Hotkey Test</h2><p>Try Cmd+Shift+K and F5</p><pre id="log"></pre>');

  const shortcuts = [
    'CommandOrControl+Shift+K',
    'F5',
    'F1',
    'Escape',
    'CommandOrControl+F5',
  ];

  for (const s of shortcuts) {
    const ok = globalShortcut.register(s, () => {
      console.log(`>>> ${s} FIRED!`);
    });
    console.log(`Register "${s}": ${ok ? 'OK' : 'FAILED'}`);
  }

  console.log('');
  console.log('Press any of the registered shortcuts. Waiting 30s...');

  setTimeout(() => {
    globalShortcut.unregisterAll();
    app.quit();
  }, 30000);
});
app.on('window-all-closed', () => app.quit());
