Task 28: README.md updated with Cross-Platform Electron section
Date: 2026-03-11

CHANGES MADE:
- Added new top-level section "# WhisperApp — Cross-Platform (Electron)" at the very beginning of README.md
- Included Quick Install instructions for macOS (DMG), Windows (exe), Linux (AppImage/deb/rpm)
- Added GNOME AppIndicator note for Linux system tray
- Added Build from Source (Electron) section: cd electron-app && npm install && npm run dev/build/make
- Added Configuration section for tray icon settings
- Preserved all original README content verbatim
- Changed original "# WhisperApp" heading to "## Legacy macOS-only Version (Apple Silicon)"
- Added blockquote note pointing cross-platform users to the new Electron section

VERIFICATION:
- README.md line count: 605 lines (was 557)
- New Electron section at lines 1-48
- Legacy section marker at line 50
- Original content preserved from line 52 onward
- Horizontal rule (---) separates new Electron section from legacy content

SOURCE FILES READ:
- README.md (original, 557 lines)
- .github/workflows/release-electron.yml (release workflow, tag-based on v*)

The release workflow confirms: releases are tag-triggered (v*), builds on macos-14/windows-latest/ubuntu-22.04,
produces artifacts via npm run make, published via gh release create with DMG/exe/AppImage/deb/rpm assets.
