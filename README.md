# WhisperApp — Cross-Platform (Electron)

A cross-platform desktop app for speech-to-text transcription. Works on macOS (Apple Silicon + Intel), Windows, and Linux.

## Quick Install

### macOS
1. Download `WhisperApp-mac-universal.dmg` from [Releases](https://github.com/rbarinov/whisper-app/releases/latest)
2. Open the DMG, drag WhisperApp.app to Applications
3. Run: `xattr -cr /Applications/WhisperApp.app`

### Windows
1. Download `WhisperApp-Setup.exe` from [Releases](https://github.com/rbarinov/whisper-app/releases/latest)
2. Run the installer
3. If SmartScreen appears: click "More info" → "Run anyway"

### Linux
**AppImage:**
```bash
chmod +x WhisperApp-*.AppImage
./WhisperApp-*.AppImage
```
**deb:** `sudo dpkg -i whisperapp_*.deb`
**rpm:** `sudo rpm -i whisperapp-*.rpm`

> **Linux note:** On GNOME, install the [AppIndicator extension](https://extensions.gnome.org/extension/615/appindicator-support/) to see the system tray icon.

## Build from Source

```bash
# Prerequisites: Node.js 20+
cd electron-app
npm install
npm run dev      # Development mode
npm run build    # Production build
npm run make     # Build platform package (DMG/exe/AppImage)
```

## Configuration

Click the tray icon → Settings to configure:
- **API Base URL**: Your Whisper API endpoint (default: `https://api.openai.com`)
- **API Key**: Your API key
- **Hotkey**: Default F5 (hold to record, release to transcribe)

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

GitHub Actions will automatically build the Electron app for all platforms and create a GitHub Release.

The release will appear at [github.com/rbarinov/whisper-app/releases](https://github.com/rbarinov/whisper-app/releases).

## License

MIT License - Copyright (c) 2026 Roman Barinov. See [LICENSE](LICENSE) for details.
