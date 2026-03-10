---
name: local-app-restart
description: Build the Xcode project locally, kill the running app, and launch the new build for testing
---

## What I do

Compile the project with Xcode, stop any running instance of the app, and launch the freshly built binary so the user can immediately test changes.

## When to use me

Use this skill when the user asks to rebuild, relaunch, restart, or test the app locally after making code changes.

## Build

The project uses Xcode. The system `xcode-select` may point to CommandLineTools instead of Xcode.app, so always override with `DEVELOPER_DIR`:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild \
    -project WhisperApp/WhisperApp.xcodeproj \
    -scheme WhisperApp \
    -configuration Debug \
    build 2>&1
```

- If the build succeeds, proceed to the restart step.
- If the build fails, show the compiler errors to the user and stop. Do not kill the running app if the build failed.

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

## Restart

1. **Kill the running instance**
   ```bash
   pkill -x WhisperApp
   ```
   Wait briefly for the process to exit. If no process is running, that is fine — skip to launch.

2. **Launch the new build**
   ```bash
   open "<BUILT_PRODUCTS_DIR>/WhisperApp.app"
   ```

3. **Verify launch**
   ```bash
   pgrep -fl WhisperApp
   ```
   Confirm the new process is running and its path points to the DerivedData build, not `/Applications/` or `~/Applications/`.

## Error handling

- If `xcodebuild` is not found or fails with a toolchain error, check that `/Applications/Xcode.app` exists and suggest the user install Xcode.
- If `sudo` is needed for `xcode-select -s`, use the `DEVELOPER_DIR` env var override instead — do not require sudo.
- If the app fails to launch (no process after `open`), report it to the user.
- Never kill the running app before a successful build — the user should always have a working version running.

## Important rules

- Always build before killing. A failed build must not leave the user without a running app.
- Filter build output for errors on failure; show the full output only if the user asks.
- This skill is for local development testing only — it does not produce release-quality builds.
