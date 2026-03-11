/**
 * Test CGEvent tap using Electron's globalShortcut as a control,
 * and also test if we can receive raw IOKit HID events.
 */
const { app, systemPreferences, globalShortcut, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  console.log('Trusted:', systemPreferences.isTrustedAccessibilityClient(false));
  
  // Test 1: globalShortcut (uses Carbon RegisterEventHotKey under the hood)
  const registered = globalShortcut.register('CommandOrControl+Shift+F5', () => {
    console.log('>>> Cmd+Shift+F5 via globalShortcut!');
  });
  console.log('globalShortcut Cmd+Shift+F5 registered:', registered);

  // Test 2: Try plain F5
  const reg2 = globalShortcut.register('F5', () => {
    console.log('>>> F5 via globalShortcut!');
  });
  console.log('globalShortcut F5 registered:', reg2);

  // Test 3: Create a visible window and capture key events via the DOM
  const win = new BrowserWindow({ 
    width: 400, height: 200, 
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadURL('data:text/html,<h2>Press F5 or any key here</h2><pre id="log"></pre><script>document.addEventListener("keydown",e=>{document.getElementById("log").textContent+=e.key+" (code:"+e.code+")\\n";const{ipcRenderer}=require("electron");ipcRenderer.send("keytest",e.key,e.code);})</script>');

  const { ipcMain } = require('electron');
  ipcMain.on('keytest', (ev, key, code) => {
    console.log(`[Window keydown] key=${key} code=${code}`);
  });

  console.log('');
  console.log('=== Try pressing keys IN THE WINDOW and also when window is not focused ===');
  console.log('Waiting 20 seconds...');

  setTimeout(() => {
    globalShortcut.unregisterAll();
    app.quit();
  }, 20000);
});
app.on('window-all-closed', (e) => e.preventDefault());
