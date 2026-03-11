---
name: local-app-restart
description: Build and launch the app locally (Electron or native Swift) for testing
---

## What I do

Build the project, stop any running instance, and launch the freshly built binary so the user can immediately test changes. The project has two app variants — ask the user which one to build if not specified.

## When to use me

Use this skill when the user asks to rebuild, relaunch, restart, or test the app locally after making code changes.

## Choosing the variant

The project contains two app targets:

| Variant | Location | When to use |
|---------|----------|-------------|
| **Electron app** | `electron-app/` | Default. Full-featured app with React UI. Accessibility features require the packaged build (not dev mode). |
| **Native Swift app** | `WhisperApp/` | Lightweight native macOS build using SwiftUI. |

If the user says "restart the app" or "rebuild" without specifying which variant, **ask them which one they want**. If they say "electron" or "native"/"swift", proceed with that variant.

---

## Option A — Electron app

### A1. Build the main process and renderer

```bash
cd electron-app
npm run build:main 2>&1
npm run build 2>&1
```

- `build:main` compiles TypeScript for the main process, bundles the preload script, and builds native addons.
- `build` runs webpack in production mode for the renderer.
- If either step fails, show errors to the user and stop. Do **not** kill the running app.

### A2. Package with electron-builder

```bash
cd electron-app
npm run make 2>&1
```

This produces a signed `.app` bundle at:
```
electron-app/release/mac-arm64/WhisperApp.app
```

- If packaging fails, show errors and stop.

### A3. Kill the running instance

```bash
pkill -f "electron-app/release/mac-arm64/WhisperApp.app" 2>/dev/null
pkill -f "electron-app/node_modules/.bin/electron" 2>/dev/null
```

Wait briefly for processes to exit. If nothing is running, that is fine — skip to launch.

### A4. Launch the packaged app

```bash
open "electron-app/release/mac-arm64/WhisperApp.app"
```

### A5. Verify launch

```bash
pgrep -fl WhisperApp
```

Confirm the process path points to `electron-app/release/mac-arm64/WhisperApp.app`, **not** a dev-mode Electron process.

> **Important:** Do not use `npx electron .` or `npm run dev` to launch — accessibility permissions do not work in unpackaged dev mode. Always use the packaged build.

---

## Option B — Native Swift app

### B1. Build with Xcode

The system `xcode-select` may point to CommandLineTools instead of Xcode.app, so always override with `DEVELOPER_DIR`:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild \
    -project WhisperApp/WhisperApp.xcodeproj \
    -scheme WhisperApp \
    -configuration Debug \
    build 2>&1
```

- If the build succeeds, proceed to the restart step.
- If the build fails, show the compiler errors to the user and stop. Do not kill the running app.

### B2. Locate the built binary

The built binary lands in DerivedData at a path like:
```
~/Library/Developer/Xcode/DerivedData/WhisperApp-<hash>/Build/Products/Debug/WhisperApp.app
```

To find the exact path:
```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild \
    -project WhisperApp/WhisperApp.xcodeproj \
    -scheme WhisperApp \
    -configuration Debug \
    -showBuildSettings 2>/dev/null \
  | grep -m1 'BUILT_PRODUCTS_DIR' \
  | awk '{print $3}'
```

### B3. Kill the running instance

```bash
pkill -x WhisperApp
```

Wait briefly for the process to exit. If no process is running, skip to launch.

### B4. Launch the new build

```bash
open "<BUILT_PRODUCTS_DIR>/WhisperApp.app"
```

### B5. Verify launch

```bash
pgrep -fl WhisperApp
```

Confirm the new process is running and its path points to the DerivedData build, not `/Applications/` or `~/Applications/`.

---

## Error handling

- If `xcodebuild` is not found or fails with a toolchain error, check that `/Applications/Xcode.app` exists and suggest the user install Xcode.
- If `sudo` is needed for `xcode-select -s`, use the `DEVELOPER_DIR` env var override instead — do not require sudo.
- If the app fails to launch (no process after `open`), report it to the user.
- Never kill the running app before a successful build — the user should always have a working version running.

## Important rules

- **Always build before killing.** A failed build must not leave the user without a running app.
- Filter build output for errors on failure; show the full output only if the user asks.
- This skill is for local development testing only — it does not produce release-quality builds.
- For the Electron variant, always use the packaged build (`npm run make`), never dev mode, to ensure accessibility works.
