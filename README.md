# WhisperApp

A lightweight macOS menu bar app for speech-to-text transcription using OpenAI-compatible Whisper API. Hold a hotkey to record, release to transcribe, and the text is automatically pasted into the active text field.

## Features

- **Menu bar app** — lives in the system tray, no Dock icon clutter
- **Global hotkey** (default: F5) with two modes:
  - **Hold-to-record**: hold the key, speak, release to transcribe
  - **Toggle mode**: double-press to start recording, double-press again to stop
- **Auto-paste** — transcribed text is automatically inserted into the currently focused text field via clipboard + simulated Cmd+V
- **Floating overlay** — a compact semi-transparent indicator above the Dock shows recording/transcribing/done status
- **History window** — browse past transcriptions with copy/delete buttons
- **Settings window** — configure API endpoint, key, model, language, and hotkey
- **OpenAI-compatible API** — works with OpenAI, local Whisper servers, or any `/v1/audio/transcriptions` endpoint
- **Language hint** — optionally specify the spoken language (ISO-639-1) for improved accuracy
- **Retry with backoff** — network requests retry up to 3 times on transient failures
- **Persistent settings** — all configuration and history stored as JSON in `~/Library/Application Support/WhisperApp/`

## Requirements

- macOS 13.0+ (Ventura or later)
- Apple Silicon or Intel Mac
- Xcode Command Line Tools with Swift (no Xcode.app required)
- An OpenAI API key (or compatible endpoint)

## Building

The project builds with `swiftc` directly — no Xcode.app needed:

```bash
chmod +x build.sh
./build.sh
```

This will:
1. Compile all Swift sources targeting `arm64-apple-macosx13.0`
2. Create `WhisperApp.app` bundle with Info.plist and entitlements
3. Code-sign with your Apple Development identity (falls back to ad-hoc if none found)
4. Install to `~/Applications/WhisperApp.app`

To run after building:

```bash
open ~/Applications/WhisperApp.app
```

## Permissions

On first launch, the app will request:

- **Microphone** — needed to record audio for transcription
- **Accessibility** — needed for the global hotkey (CGEvent tap) and simulated Cmd+V paste

Grant both in **System Settings > Privacy & Security**.

> **Note**: Ad-hoc signed builds cause macOS to forget permissions on every rebuild. The build script automatically uses a real Apple Development identity if available to avoid this.

## Configuration

Open Settings from the menu bar icon:

| Setting | Description | Default |
|---------|-------------|---------|
| Base URL | API endpoint base | `https://api.openai.com` |
| API Key | Bearer token for authentication | (empty) |
| Model | Whisper model name | `whisper-1` |
| Language | ISO-639-1 code (`en`, `ru`, `de`, etc.) | auto-detect |
| Hotkey | Key to trigger recording | F5 |

## Architecture

```
WhisperApp/
  WhisperApp.swift          # App entry point, MenuBarExtra, WindowManager
  Info.plist                # LSUIElement, mic usage description
  WhisperApp.entitlements   # Audio input entitlement
  Models/
    AppSettings.swift       # Settings persistence, hotkey config, key mapping
    TranscriptionEntry.swift # History entry model
  ViewModels/
    AppState.swift          # Central state management, recording flow
  Services/
    AudioRecorder.swift     # AVAudioRecorder — 16kHz mono WAV
    TranscriptionService.swift # Multipart POST to Whisper API with retry
    HotkeyManager.swift     # CGEvent tap on background thread, state machine
    PasteService.swift      # Clipboard + simulated Cmd+V
  Views/
    MenuBarView.swift       # Tray dropdown with hover effects
    HistoryView.swift       # Transcription history window
    SettingsView.swift      # Settings + hotkey capture
    RecordingOverlayView.swift # Floating status overlay above Dock
```

### Key Technical Details

- **Non-sandboxed** — CGEvent taps don't work in sandbox
- **Apple Silicon F-key handling** — F3-F6 send different keycodes (160, 177, 176, 178) than the traditional Carbon constants on Apple Silicon Macs. Both mappings are supported.
- **NX_SYSDEFINED fallback** — some Mac models send media key events instead of regular keyDown/keyUp for F-keys. The event tap handles both paths.
- **Window management** — History/Settings windows toggle `NSApp.setActivationPolicy` between `.regular` and `.accessory` so they appear in Cmd+Tab only when visible
- **Bootstrap pattern** — `MenuBarExtra`-only apps with `LSUIElement=true` have lifecycle quirks; setup is triggered via a static initializer to ensure it runs

## License

MIT License - Copyright (c) 2026 Roman Barinov. See [LICENSE](LICENSE) for details.
