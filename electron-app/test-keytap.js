const { app } = require('electron');
const keytap = require('./native/keytap/build/Release/keytap.node');

app.on('ready', () => {
  console.log('[TEST] Electron ready. Starting keytap CGEvent tap...');
  console.log('[TEST] Press F5, Escape, or any key within 15 seconds.');

  keytap.start((event) => {
    console.log('[TEST] Event:', JSON.stringify(event));
  });

  setTimeout(() => {
    console.log('[TEST] 15s elapsed. Stopping.');
    keytap.stop();
    app.quit();
  }, 15000);
});

app.on('window-all-closed', (e) => e.preventDefault());
