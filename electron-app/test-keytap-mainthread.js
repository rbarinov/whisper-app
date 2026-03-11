const { app } = require('electron');

app.whenReady().then(() => {
  console.log('Electron ready. Testing CGEvent tap on main thread via native code...');

  // Use the raw Objective-C approach via ffi or direct addon
  // But first, let's try the simpler Electron approach
  const { globalShortcut } = require('electron');

  // Test if globalShortcut works at all
  const ret = globalShortcut.register('F5', () => {
    console.log('>>> F5 pressed via globalShortcut!');
  });
  console.log('globalShortcut.register F5 result:', ret);

  const ret2 = globalShortcut.register('Escape', () => {
    console.log('>>> Escape pressed via globalShortcut!');
  });
  console.log('globalShortcut.register Escape result:', ret2);

  setTimeout(() => {
    console.log('15s elapsed. Stopping.');
    globalShortcut.unregisterAll();
    app.quit();
  }, 15000);
});

app.on('window-all-closed', (e) => e.preventDefault());
