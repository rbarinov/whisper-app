## [2026-03-11] Task 10: Paste Service
- Wayland detection: XDG_SESSION_TYPE === 'wayland' OR WAYLAND_DISPLAY set
- Clipboard write: Electron clipboard.writeText (built-in)
- Keyboard sim: @nut-tree/nut-js (optional — graceful fallback if unavailable)
- Platform: darwin → Meta+V, else → Control+V (G12)
- 50ms delay between clipboard write and key simulation
- PasteOptions interface enables full DI for testing (clipboardWrite, keyboardSimulator, isWayland, delayMs)
- No save/restore of clipboard contents (G17 — simpler than Swift version)
- tryLoadNutJs() uses dynamic require with try/catch — returns null if package missing
