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

Step-by-step guide. No developer tools needed.

### Step 1: Download

1. Open [**Releases**](https://github.com/rbarinov/whisper-app/releases/latest) in your browser
2. Under **Assets**, click **WhisperApp-macOS-arm64.zip** to download it
3. The file will appear in your `~/Downloads` folder

### Step 2: Extract

1. Open **Finder**, go to **Downloads**
2. Double-click `WhisperApp-macOS-arm64.zip` — it will extract into a `WhisperApp.app` file
3. Drag `WhisperApp.app` into your **Applications** folder (or `~/Applications/`)

### Step 3: Bypass macOS Gatekeeper (IMPORTANT)

macOS blocks apps that are not signed with an Apple Developer ID certificate. You **will** see a warning like _"WhisperApp can't be opened because Apple cannot check it for malicious software"_ or _"WhisperApp is damaged and can't be opened"_. This is normal for self-built apps.

**Option A — Remove quarantine attribute (recommended, one command):**

Open **Terminal** (Spotlight → type "Terminal" → Enter) and run:

```bash
xattr -cr ~/Applications/WhisperApp.app
```

If you placed the app in `/Applications/` instead:

```bash
xattr -cr /Applications/WhisperApp.app
```

This removes the quarantine flag that macOS adds to downloaded files. After this, the app will open normally.

**Option B — Allow in System Settings (if Option A doesn't work):**

1. Try to open `WhisperApp.app` — it will be blocked with a warning. Click **Done** (or **Cancel**)
2. Open **System Settings** (Apple menu  → System Settings)
3. Go to **Privacy & Security** (scroll down in the left sidebar)
4. Scroll down to the **Security** section
5. You will see a message: _"WhisperApp was blocked from use because it is not from an identified developer"_
6. Click **Open Anyway**
7. Enter your password or use Touch ID
8. Try opening the app again — this time click **Open** in the dialog

**Option C — Right-click → Open (sometimes works):**

1. In Finder, right-click (or Control-click) on `WhisperApp.app`
2. Select **Open** from the context menu
3. A dialog will appear — click **Open**

> **Note**: You may need to repeat Option B after the first attempt. macOS sometimes requires two tries.

### Step 4: Grant Permissions

On first launch, the app needs two permissions:

**Microphone:**
- macOS will show a popup: _"WhisperApp would like to access the microphone"_
- Click **OK** / **Allow**
- If you missed the popup: **System Settings → Privacy & Security → Microphone** → toggle WhisperApp ON

**Accessibility:**
- The app will show a system prompt asking for Accessibility access
- Click **Open System Settings** — it will take you to the right place
- Find **WhisperApp** in the list and toggle it **ON**
- You may need to click the lock icon and enter your password first
- If the prompt didn't appear: **System Settings → Privacy & Security → Accessibility** → click **+** → navigate to Applications → select `WhisperApp.app` → click Open

> **After granting Accessibility**: the app may need a restart to pick up the permission. Click the mic icon in the menu bar → **Quit WhisperApp**, then open it again.

### Step 5: Configure

1. Look for a **microphone icon** (🎤) in the **menu bar** (top-right of your screen, near the clock)
2. Click it → click **Settings**
3. Fill in:
   - **Base URL**: leave as `https://api.openai.com` for OpenAI, or enter your custom endpoint
   - **API Key**: paste your OpenAI API key (starts with `sk-...`)
   - **Model**: leave as `whisper-1` (or enter your model name)
   - **Language**: optionally enter a language code like `en`, `ru`, `de` for better accuracy (leave empty for auto-detect)
4. Close the Settings window

### Step 6: Use

- **Hold F5** → speak → **release F5** → text is transcribed and pasted into the active text field
- **Double-press F5** → recording starts, **double-press F5 again** → recording stops and text is transcribed
- A small dark overlay above the Dock shows the current status (recording / transcribing / done)

### Troubleshooting

| Problem | Solution |
|---------|----------|
| App won't open, shows "damaged" warning | Run `xattr -cr ~/Applications/WhisperApp.app` in Terminal |
| App won't open, shows "unidentified developer" | System Settings → Privacy & Security → scroll down → Open Anyway |
| No mic icon in menu bar | Check Activity Monitor if WhisperApp is running. If not, reopen it |
| F5 doesn't trigger recording | System Settings → Privacy & Security → Accessibility → make sure WhisperApp is ON. Restart the app after toggling |
| "Microphone access denied" error | System Settings → Privacy & Security → Microphone → toggle WhisperApp ON |
| "Network error" on first try | The app retries automatically. Check your API key and Base URL in Settings |
| "Event tap failed" in Settings | Accessibility permission not granted. Follow Step 4 above |

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
