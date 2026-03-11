const { app, systemPreferences } = require('electron');

app.whenReady().then(() => {
  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  console.log('Accessibility trusted:', trusted);
  console.log('Process execPath:', process.execPath);

  // Try to actually create a CGEvent tap via our addon
  try {
    const keytap = require('./native/keytap/build/Release/keytap.node');
    let gotReady = false;
    let gotEvents = false;

    keytap.start((event) => {
      if (event.type === 'ready') {
        gotReady = true;
        console.log('CGEvent tap created successfully');
      } else if (event.type === 'error') {
        console.log('CGEvent tap ERROR:', event.message);
      } else {
        gotEvents = true;
        console.log('KEY EVENT:', JSON.stringify(event));
      }
    });

    setTimeout(() => {
      console.log('--- Results after 10s ---');
      console.log('Tap created:', gotReady);
      console.log('Got events:', gotEvents);
      keytap.stop();
      app.quit();
    }, 10000);
  } catch (e) {
    console.log('Failed to load keytap:', e.message);
    app.quit();
  }
});

app.on('window-all-closed', (e) => e.preventDefault());
