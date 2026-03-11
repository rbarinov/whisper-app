## [2026-03-11] Task 15: System Tray
- TrayManager class in src/main/tray.ts
- Icons: assets/icons/tray-idle.png, tray-recording.png, tray-busy.png (16x16 transparent PNGs)
- macOS: nativeImage template images for dark/light menu bar adaptation
- Context menu rebuilt on state change via updateState(RecordingState)
- Icon mapping: idle/error → tray-idle, recording → tray-recording, transcribing/processing → tray-busy
- Menu items: Status (disabled), Start/Stop Recording (conditional), History, Settings, Quit
- Start/Stop Recording click handler is a placeholder — actual recording flow wired in T21
- Icon paths resolve from dist/main/ → ../../assets/icons/ using __dirname
