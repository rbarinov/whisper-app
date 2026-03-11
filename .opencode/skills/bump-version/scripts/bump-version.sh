#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

usage() {
  echo "Usage: $0 <patch|minor|major|X.Y.Z>" >&2
}

if [ "${1:-}" = "" ]; then
  usage
  exit 1
fi

INPUT="$1"
PACKAGE_JSON="$REPO_ROOT/electron-app/package.json"
VERSION_TS="$REPO_ROOT/electron-app/src/shared/version.ts"
INFO_PLIST="$REPO_ROOT/WhisperApp/WhisperApp/Info.plist"
PBXPROJ="$REPO_ROOT/WhisperApp/WhisperApp.xcodeproj/project.pbxproj"

CURRENT_VERSION="$(node -p "require(process.argv[1]).version" "$PACKAGE_JSON")"

if [ -f "$VERSION_TS" ]; then
  SHARED_VERSION="$(node -e "const fs=require('fs'); const m=fs.readFileSync(process.argv[1],'utf8').match(/APP_VERSION = '([^']+)'/); if (!m) process.exit(2); process.stdout.write(m[1]);" "$VERSION_TS")"
  if [ "$SHARED_VERSION" != "$CURRENT_VERSION" ]; then
    echo "Version mismatch: package.json=$CURRENT_VERSION, version.ts=$SHARED_VERSION" >&2
    exit 1
  fi
fi

TARGET_VERSION="$(
  CURRENT_VERSION="$CURRENT_VERSION" INPUT="$INPUT" node <<'NODE'
const current = process.env.CURRENT_VERSION;
const input = process.env.INPUT;

const exact = /^\d+\.\d+\.\d+$/;
if (exact.test(input)) {
  process.stdout.write(input);
  process.exit(0);
}

if (!['patch', 'minor', 'major'].includes(input)) {
  console.error(`Unsupported version input: ${input}`);
  process.exit(1);
}

const parts = current.split('.').map(Number);
if (parts.length !== 3 || parts.some(Number.isNaN)) {
  console.error(`Current version is not SemVer: ${current}`);
  process.exit(1);
}

let [major, minor, patch] = parts;
if (input === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (input === 'minor') {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

process.stdout.write(`${major}.${minor}.${patch}`);
NODE
)"

if ! [[ "$TARGET_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Target version must be SemVer, got: $TARGET_VERSION" >&2
  exit 1
fi

(
  cd "$REPO_ROOT/electron-app"
  npm version "$TARGET_VERSION" --no-git-tag-version --allow-same-version >/dev/null
)

node - "$REPO_ROOT" "$TARGET_VERSION" <<'NODE'
const fs = require('fs');
const path = require('path');

const [repoRoot, targetVersion] = process.argv.slice(2);

function updateFile(relativePath, transform) {
  const filePath = path.join(repoRoot, relativePath);
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after === before) {
    return;
  }
  fs.writeFileSync(filePath, after);
}

updateFile('electron-app/src/shared/version.ts', () => {
  return [
    '// Keep this in sync with the numeric portion of the publish tag, for example:',
    '// APP_VERSION=1.2.2 <-> publish tag v1.2.2',
    `export const APP_VERSION = '${targetVersion}';`,
    'export const APP_RELEASE_TAG = `v${APP_VERSION}`;',
    "export const APP_REPOSITORY_URL = 'https://github.com/rbarinov/whisper-app';",
    'export const APP_LEGAL_NOTICE = `Version ${APP_VERSION}. Copyright Roman Barinov, 2026. Licensed under the MIT License.`;',
    '',
  ].join('\n');
});

updateFile('WhisperApp/WhisperApp/Info.plist', (input) => {
  return input
    .replace(/(<key>CFBundleVersion<\/key>\s*<string>)([^<]+)(<\/string>)/, `$1${targetVersion}$3`)
    .replace(/(<key>CFBundleShortVersionString<\/key>\s*<string>)([^<]+)(<\/string>)/, `$1${targetVersion}$3`);
});

updateFile('WhisperApp/WhisperApp.xcodeproj/project.pbxproj', (input) => {
  return input
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${targetVersion};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${targetVersion};`);
});
NODE

echo "Updated version to $TARGET_VERSION (publish tag v$TARGET_VERSION)."
