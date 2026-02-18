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

## Install from Release (Recommended)

The fastest way to get started — no build tools needed:

1. Go to [**Releases**](https://github.com/rbarinov/whisper-app/releases/latest)
2. Download **WhisperApp-macOS-arm64.zip**
3. Extract and move `WhisperApp.app` to `~/Applications/` (or `/Applications/`)
4. **First launch**: right-click the app > **Open** (macOS blocks unsigned apps by default)
5. Grant **Microphone** and **Accessibility** permissions when prompted
6. Click the microphone icon in the menu bar > **Settings** > enter your API key

> **Tip**: For persistent permissions, re-sign the app locally with your Apple Development identity:
> ```bash
> codesign --force --sign "Apple Development: Your Name (XXXXXXXXXX)" ~/Applications/WhisperApp.app
> ```

---

## Build from Source

### 1. Download

```bash
git clone git@github.com:rbarinov/whisper-app.git
cd whisper-app
```

Or download the source as ZIP from GitHub and extract.

### 2. Prerequisites

- **macOS 13.0+** (Ventura or later)
- **Apple Silicon or Intel Mac**
- **Xcode Command Line Tools** — install if you don't have them:
  ```bash
  xcode-select --install
  ```
  This provides the Swift compiler. Full Xcode.app is **not** required.
- **OpenAI API key** (or any OpenAI-compatible Whisper endpoint)

### 3. Build & Install

```bash
chmod +x build.sh
./build.sh
```

The build script will:
1. Compile all Swift sources for your architecture
2. Create the `WhisperApp.app` bundle
3. Sign the app with your Apple Development identity (if available; falls back to ad-hoc)
4. Install to `~/Applications/WhisperApp.app`

> **Tip**: If you have an Apple Developer account enrolled in the Apple Developer Program, the build script will automatically find and use your signing identity. This lets macOS remember permissions across rebuilds. Without it, ad-hoc signing works but you may need to re-grant Accessibility and Microphone permissions after each rebuild.

### 4. Launch

```bash
open ~/Applications/WhisperApp.app
```

A microphone icon will appear in your menu bar.

### 5. Grant Permissions

On first launch, macOS will prompt for two permissions:

| Permission | Why | Where to grant |
|---|---|---|
| **Microphone** | Record speech for transcription | System Settings > Privacy & Security > Microphone |
| **Accessibility** | Global hotkey capture + auto-paste | System Settings > Privacy & Security > Accessibility |

If the prompts don't appear automatically, open **Settings** from the menu bar icon and click **Grant** / **Retry**.

### 6. Configure

Click the microphone icon in the menu bar, then **Settings**:

1. Enter your **API Base URL** (default: `https://api.openai.com`)
2. Enter your **API Key**
3. Optionally set a **Language** code (e.g. `en`, `ru`, `de`) for better accuracy
4. Click **Change** to reassign the hotkey, or leave it as F5

### 7. Use

- **Hold F5** — start recording, release to transcribe and auto-paste
- **Double-press F5** — toggle recording on/off (for longer dictation)
- A floating indicator above the Dock shows the current status

### Updating

To update to a newer version:

```bash
cd whisper-app
git pull
./build.sh
```

Your settings and history are preserved in `~/Library/Application Support/WhisperApp/`.

### Uninstalling

```bash
# Remove the app
rm -rf ~/Applications/WhisperApp.app

# Remove settings and history (optional)
rm -rf ~/Library/Application\ Support/WhisperApp
```

Then remove WhisperApp from **System Settings > Privacy & Security > Accessibility** and **Microphone**.

## Configuration

Open Settings from the menu bar icon:

| Setting | Description | Default |
|---------|-------------|---------|
| Base URL | API endpoint base | `https://api.openai.com` |
| API Key | Bearer token for authentication | (empty) |
| Model | Whisper model name | `whisper-1` |
| Language | ISO-639-1 code (`en`, `ru`, `de`, etc.) | auto-detect |
| Hotkey | Key to trigger recording | F5 |

## Releasing a New Version

The project uses [Semantic Versioning](https://semver.org/) and Git tags to trigger releases.

Version format: `vMAJOR.MINOR.PATCH`

| Bump | When | Example |
|------|------|---------|
| PATCH | Bug fixes, minor tweaks | `v1.0.0` → `v1.0.1` |
| MINOR | New features, backward-compatible | `v1.0.1` → `v1.1.0` |
| MAJOR | Breaking changes | `v1.1.0` → `v2.0.0` |

To create a release:

```bash
# Tag the current commit
git tag v1.0.0

# Push the tag — this triggers the release workflow
git push origin v1.0.0
```

GitHub Actions will automatically:
1. Build the app on an Apple Silicon runner
2. Package `WhisperApp.app` into a ZIP
3. Create a GitHub Release with the ZIP attached and auto-generated release notes

The release will appear at [github.com/rbarinov/whisper-app/releases](https://github.com/rbarinov/whisper-app/releases).

To list existing tags:

```bash
git tag --list
```

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
