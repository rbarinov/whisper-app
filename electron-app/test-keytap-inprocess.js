/**
 * Test the in-process keytap N-API addon inside Electron.
 * If this works, F5 hotkeys will work in the app.
 * If this shows no events, the user needs to toggle Accessibility permission.
 */
const { app, systemPreferences, dialog } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  console.log('Accessibility isTrusted:', trusted);
  console.log('Electron binary:', process.execPath);

  const addonPath = path.resolve(__dirname, 'native/keytap/build/Release/keytap.node');
  let keytap;
  try {
    keytap = require(addonPath);
  } catch (e) {
    console.error('Failed to load keytap addon:', e.message);
    app.quit();
    return;
  }

  let eventCount = 0;

  keytap.start((event) => {
    eventCount++;
    console.log('Event:', JSON.stringify(event));
  });

  console.log('');
  console.log('=== PRESS ANY KEY (F5, Escape, letters, anything) ===');
  console.log('Waiting 12 seconds...');
  console.log('');

  setTimeout(() => {
    keytap.stop();
    console.log('');
    console.log(`=== RESULT: ${eventCount} events received ===`);

    if (eventCount <= 1) { // 1 = just the "ready" event
      console.log('');
      console.log('❌ NO KEY EVENTS DETECTED.');
      console.log('');
      console.log('This means macOS Accessibility permission is STALE.');
      console.log('Fix: System Settings → Privacy & Security → Accessibility');
      console.log('  1. Find "Electron" in the list');
      console.log('  2. Toggle it OFF');
      console.log('  3. Toggle it back ON');
      console.log('  4. Re-run this test');
    } else {
      console.log('✅ Key events working! The app hotkeys should work.');
    }

    app.quit();
  }, 12000);
});

app.on('window-all-closed', (e) => e.preventDefault());
