#!/bin/bash
# Copyright (c) 2026 Roman Barinov. MIT License.
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$PROJECT_DIR/WhisperApp/WhisperApp"
BUILD_DIR="$PROJECT_DIR/build"
APP_NAME="WhisperApp"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"

SDK_PATH=$(xcrun --show-sdk-path)

# Auto-discover all Swift source files
SOURCES=()
while IFS= read -r -d '' file; do
    SOURCES+=("$file")
done < <(find "$SRC_DIR" -name '*.swift' -type f -print0 | sort -z)

if [ ${#SOURCES[@]} -eq 0 ]; then
    echo "ERROR: No Swift source files found in $SRC_DIR"
    exit 1
fi

echo "==> Cleaning build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

echo "==> Compiling $APP_NAME (${#SOURCES[@]} source files)..."
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

# Signing — skip if SKIP_SIGN=1 (CI handles signing separately)
if [ "${SKIP_SIGN:-0}" != "1" ]; then
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
fi

# Install — skip in CI mode
if [ "${CI:-}" != "true" ]; then
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
else
    echo ""
    echo "==> Build successful!"
    echo "    Output: $APP_BUNDLE"
fi
