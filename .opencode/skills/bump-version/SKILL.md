---
name: bump-version
description: Sync this repo to a new release version by updating the Electron app version, the shared legal/version text, and the native macOS version files before tagging
---

## What I do

Prepare the repo for the next release version so the app UI, package metadata, and native macOS metadata all match the publish tag.

## When to use me

Use this skill when the user asks to bump the version, prepare the next release number, sync the repo to the latest published tag, or update version strings before tagging.

## Version rules

- Publish tags use `vMAJOR.MINOR.PATCH`.
- Repo files store the numeric part only: `MAJOR.MINOR.PATCH`.
- The Electron legal notice must always display the same numeric version.

## Files this skill owns

- `electron-app/package.json`
- `electron-app/package-lock.json`
- `electron-app/src/shared/version.ts`
- `WhisperApp/WhisperApp/Info.plist`
- `WhisperApp/WhisperApp.xcodeproj/project.pbxproj`

## Workflow

1. Read the current version from `electron-app/package.json`, `electron-app/src/shared/version.ts`, and the latest tag:
   ```bash
   node -p "require('./electron-app/package.json').version"
   git tag --list 'v*' --sort=-v:refname | head -1
   ```
2. If the package version and shared version do not match, stop and report the mismatch.
3. Choose the target version.
   - If the user gives an exact version, use it.
   - If the user says `patch`, `minor`, or `major`, compute the next SemVer from the current repo version.
   - If the repo is behind the latest tag and the request is to sync, use the latest tag's numeric portion.
4. Run:
   ```bash
   ./.opencode/skills/bump-version/scripts/bump-version.sh <target-version-or-bump>
   ```
5. Show the resulting version values with:
   ```bash
   node -p "require('./electron-app/package.json').version"
   rg -n "APP_VERSION|CFBundleShortVersionString|CFBundleVersion|MARKETING_VERSION|CURRENT_PROJECT_VERSION" electron-app/src/shared/version.ts WhisperApp/WhisperApp/Info.plist WhisperApp/WhisperApp.xcodeproj/project.pbxproj
   ```
6. If the user is releasing immediately after, hand off to `release-and-verify`.

## Error handling

- Never create or push a git tag in this skill.
- If the requested version is not valid SemVer, stop and explain the expected format.
- If any owned file fails to update, stop and report which file is inconsistent.
