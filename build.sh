#!/bin/bash
# Copyright (c) 2026 Roman Barinov. MIT License.
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$PROJECT_DIR/WhisperApp/WhisperApp"
BUILD_DIR="$PROJECT_DIR/build"
APP_NAME="WhisperApp"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"

SDK_PATH=$(xcrun --show-sdk-path)

# Collect all Swift source files
SOURCES=(
    "$SRC_DIR/Models/TranscriptionEntry.swift"
    "$SRC_DIR/Models/AppSettings.swift"
    "$SRC_DIR/Services/AudioRecorder.swift"
    "$SRC_DIR/Services/HotkeyManager.swift"
    "$SRC_DIR/Services/TranscriptionService.swift"
    "$SRC_DIR/Services/PasteService.swift"
    "$SRC_DIR/ViewModels/AppState.swift"
    "$SRC_DIR/Views/MenuBarView.swift"
    "$SRC_DIR/Views/HistoryView.swift"
    "$SRC_DIR/Views/SettingsView.swift"
    "$SRC_DIR/Views/RecordingOverlayView.swift"
    "$SRC_DIR/WhisperApp.swift"
)

echo "==> Cleaning build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

echo "==> Compiling $APP_NAME..."
swiftc \
    -target arm64-apple-macosx13.0 \
    -sdk "$SDK_PATH" \
    -swift-version 5 \
    -O \
    -module-name WhisperApp \
    -framework AppKit \
    -framework AVFoundation \
    -framework CoreGraphics \
    -framework SwiftUI \
    -framework Carbon \
    -o "$APP_BUNDLE/Contents/MacOS/$APP_NAME" \
    "${SOURCES[@]}"

echo "==> Copying Info.plist..."
cp "$SRC_DIR/Info.plist" "$APP_BUNDLE/Contents/Info.plist"

echo "==> Copying entitlements..."
cp "$SRC_DIR/WhisperApp.entitlements" "$APP_BUNDLE/Contents/Resources/"

echo "==> Signing with entitlements..."
# Use a real developer identity so macOS can persistently remember
# Accessibility and Microphone permissions for this app.
# Ad-hoc signing (--sign -) causes macOS to forget permissions on every launch.
IDENTITY=$(security find-identity -v -p codesigning | head -1 | sed 's/.*"\(.*\)".*/\1/')
if [ -n "$IDENTITY" ] && [ "$IDENTITY" != "0 valid identities found" ]; then
    echo "    Using identity: $IDENTITY"
    codesign --force --sign "$IDENTITY" --entitlements "$SRC_DIR/WhisperApp.entitlements" "$APP_BUNDLE"
else
    echo "    WARNING: No signing identity found, using ad-hoc signing."
    echo "    macOS will forget Accessibility/Microphone permissions on every launch!"
    codesign --force --sign - --entitlements "$SRC_DIR/WhisperApp.entitlements" "$APP_BUNDLE"
fi

echo ""
echo "==> Installing to ~/Applications..."
INSTALL_DIR="$HOME/Applications"
mkdir -p "$INSTALL_DIR"
# Kill running instance before overwriting
pkill -f "WhisperApp.app/Contents/MacOS/WhisperApp" 2>/dev/null || true
sleep 0.3
rm -rf "$INSTALL_DIR/$APP_NAME.app"
cp -R "$APP_BUNDLE" "$INSTALL_DIR/$APP_NAME.app"

echo ""
echo "==> Build successful!"
echo "    Installed: $INSTALL_DIR/$APP_NAME.app"
echo ""
echo "    To run: open $INSTALL_DIR/$APP_NAME.app"
