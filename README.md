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
- **Double-press F5** → recording starts, **press F5 once** → recording stops and text is transcribed
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

## Automated Installation (for AI Agents)

This section is a precise, copy-paste-ready protocol for AI agents (Claude, ChatGPT, Cursor, etc.) to install WhisperApp on a user's Mac. Every step has a verification command. Do not skip verifications.

### Prerequisites Check

Run these commands first. If any check fails, fix it before proceeding.

```bash
# Check macOS version (must be 13.0+)
sw_vers -productVersion
# Expected: 13.x, 14.x, 15.x or higher

# Check architecture
uname -m
# Expected: arm64 (Apple Silicon) or x86_64 (Intel)

# Check if curl is available
which curl
# Expected: /usr/bin/curl

# Check if unzip is available
which unzip
# Expected: /usr/bin/unzip
```

### Step 1: Create target directory

```bash
mkdir -p ~/Applications
```

### Step 2: Download latest release

```bash
# Get the latest release download URL
DOWNLOAD_URL=$(curl -s https://api.github.com/repos/rbarinov/whisper-app/releases/latest \
  | grep "browser_download_url.*arm64.zip" \
  | cut -d '"' -f 4)

# Download the ZIP
curl -L -o /tmp/WhisperApp.zip "$DOWNLOAD_URL"
```

**Verify:**
```bash
ls -la /tmp/WhisperApp.zip
# Expected: file exists, size > 500KB
```

### Step 3: Extract and install

```bash
# Remove old version if present
rm -rf ~/Applications/WhisperApp.app

# Extract
unzip -o /tmp/WhisperApp.zip -d ~/Applications/

# Clean up
rm /tmp/WhisperApp.zip
```

**Verify:**
```bash
ls ~/Applications/WhisperApp.app/Contents/MacOS/WhisperApp
# Expected: file exists
file ~/Applications/WhisperApp.app/Contents/MacOS/WhisperApp
# Expected: Mach-O 64-bit executable arm64
```

### Step 4: Remove quarantine attribute

This is **critical**. Without this, macOS will block the app completely.

```bash
xattr -cr ~/Applications/WhisperApp.app
```

**Verify:**
```bash
xattr ~/Applications/WhisperApp.app
# Expected: no output (no attributes remaining)
```

### Step 5: Write settings (optional)

If the user has provided an API key, pre-configure it so the app is ready to use immediately.

```bash
# Create settings directory
mkdir -p ~/Library/Application\ Support/WhisperApp

# Write settings JSON (replace values as needed)
cat > ~/Library/Application\ Support/WhisperApp/settings.json << 'SETTINGS_EOF'
{
  "apiBaseURL": "https://api.openai.com",
  "apiKey": "REPLACE_WITH_API_KEY",
  "modelName": "whisper-1",
  "language": "",
  "hotkeyConfig": {
    "keyCode": 176,
    "keyName": "F5"
  }
}
SETTINGS_EOF
```

If the user specifies a language (e.g., `ru`, `en`, `de`), set `"language": "ru"` in the JSON.

If the user specifies a custom API endpoint, set `"apiBaseURL"` accordingly.

**Verify:**
```bash
cat ~/Library/Application\ Support/WhisperApp/settings.json | python3 -m json.tool
# Expected: valid JSON with the correct values
```

### Step 6: Launch the app

```bash
open ~/Applications/WhisperApp.app
```

**Verify:**
```bash
sleep 2
pgrep -x WhisperApp
# Expected: a process ID (number). If empty, the app failed to start.
```

### Step 7: Guide the user through permissions

The app requires two macOS permissions that **cannot** be granted programmatically. You must instruct the user to do these manually.

**Tell the user:**

> WhisperApp is now running (look for the microphone icon in the menu bar at the top-right of your screen).
>
> You need to grant two permissions:
>
> **1. Microphone** — a popup should appear automatically. Click "Allow".
> If no popup appeared: open **System Settings → Privacy & Security → Microphone** → toggle WhisperApp ON.
>
> **2. Accessibility** — open **System Settings → Privacy & Security → Accessibility** → find WhisperApp → toggle it ON. You may need to click the lock icon and enter your password.
>
> After granting Accessibility, quit and reopen the app:
> - Click the microphone icon in the menu bar → Quit WhisperApp
> - Then run: `open ~/Applications/WhisperApp.app`
>
> To use: **hold F5** to record, **release F5** to transcribe. The text will be pasted into whatever text field is active.

### Step 8: Verify end-to-end

After the user has granted permissions and restarted the app:

```bash
# Check the app is running
pgrep -x WhisperApp
# Expected: process ID

# Check settings were loaded
cat ~/Library/Application\ Support/WhisperApp/settings.json | python3 -m json.tool
# Expected: valid JSON with API key filled in
```

### Error Recovery

If the app won't start (no process after `open`):
```bash
# Check if macOS quarantine is blocking it
xattr ~/Applications/WhisperApp.app
# If any output appears, run: xattr -cr ~/Applications/WhisperApp.app

# Try launching from terminal to see errors
~/Applications/WhisperApp.app/Contents/MacOS/WhisperApp &
```

If "Event tap failed" in Settings:
```bash
# Accessibility not granted. Tell the user:
# System Settings → Privacy & Security → Accessibility → toggle WhisperApp ON
# Then restart the app
```

If "Microphone access denied":
```bash
# Tell the user:
# System Settings → Privacy & Security → Microphone → toggle WhisperApp ON
# Then restart the app
```

### Quick One-Liner (for experienced agents)

If you want to do everything in one block:

```bash
mkdir -p ~/Applications && \
DOWNLOAD_URL=$(curl -s https://api.github.com/repos/rbarinov/whisper-app/releases/latest | grep "browser_download_url.*arm64.zip" | cut -d '"' -f 4) && \
curl -L -o /tmp/WhisperApp.zip "$DOWNLOAD_URL" && \
rm -rf ~/Applications/WhisperApp.app && \
unzip -o /tmp/WhisperApp.zip -d ~/Applications/ && \
rm /tmp/WhisperApp.zip && \
xattr -cr ~/Applications/WhisperApp.app && \
echo "Installation complete. Run: open ~/Applications/WhisperApp.app"
```

Then tell the user to grant Microphone and Accessibility permissions.

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
- **Double-press F5** — start toggle recording (for longer dictation), **press F5 once** to stop and transcribe
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

## Contributing

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Every commit message **must** use this format:

```
<type>(<scope>): <description>
```

| Type | When to use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or CI changes |
| `chore` | Maintenance, dependencies, etc. |

Scope is optional. Examples:

```
feat(overlay): add floating recording indicator
fix(hotkey): single press to stop toggle recording
docs(readme): add installation guide
build(ci): add GitHub Actions release workflow
chore: update .gitignore
```

Breaking changes must include `BREAKING CHANGE:` in the commit body or `!` after the type:

```
feat(api)!: change transcription endpoint format
```

## Versioning

This project follows [Semantic Versioning (SemVer)](https://semver.org/).

Version format: **`vMAJOR.MINOR.PATCH`**

### What to bump

| Part | When | Reset | Example |
|------|------|-------|---------|
| **MAJOR** | Breaking changes: API format changed, config file incompatible, removed features | MINOR and PATCH reset to 0 | `v1.2.3` → `v2.0.0` |
| **MINOR** | New features that are backward-compatible: new setting, new UI element, new hotkey mode | PATCH resets to 0 | `v1.2.3` → `v1.3.0` |
| **PATCH** | Bug fixes, typo fixes, documentation updates, small tweaks that don't add features | Nothing resets | `v1.2.3` → `v1.2.4` |

### How to decide

- Did you **break** something that worked before? → **MAJOR**
- Did you **add** something new? → **MINOR**
- Did you **fix** or **improve** something existing? → **PATCH**

### How to release

1. Make sure all changes are committed and pushed to `main`
2. Determine the next version (check current: `git tag --list`)
3. Create and push the tag:

```bash
# Example: releasing a patch fix
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions will automatically:
1. Build the app on an Apple Silicon runner
2. Package `WhisperApp.app` into a ZIP
3. Create a GitHub Release with the ZIP attached and auto-generated release notes

The release will appear at [github.com/rbarinov/whisper-app/releases](https://github.com/rbarinov/whisper-app/releases).

### Version history

| Version | Date | Type | Description |
|---------|------|------|-------------|
| `v1.0.0` | 2026-02-19 | Initial | First release |

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
