const { app, systemPreferences } = require('electron');
app.whenReady().then(() => {
  // Pass true to prompt macOS to show the "grant accessibility" dialog
  const result = systemPreferences.isTrustedAccessibilityClient(true);
  console.log('isTrustedAccessibilityClient(prompt=true):', result);
  console.log('Electron binary:', process.execPath);
  console.log('');
  if (!result) {
    console.log('macOS should have shown a dialog to grant Accessibility.');
    console.log('After granting, re-run the test.');
  } else {
    console.log('Reported as trusted. But if events still fail, you need to');
    console.log('manually add the Electron binary to Accessibility:');
    console.log('  Click + in System Settings > Accessibility');
    console.log('  Navigate to:', process.execPath);
  }
  setTimeout(() => app.quit(), 3000);
});
app.on('window-all-closed', (e) => e.preventDefault());
