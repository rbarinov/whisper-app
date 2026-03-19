#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ "$(uname)" != "Darwin" ]; then
  echo "Skipping native build (macOS only)"
  exit 0
fi

swiftc -O -o hotkey-helper hotkey-helper.swift -framework CoreGraphics -framework Cocoa -framework Foundation
echo "Built hotkey-helper"

swiftc -O -o paste-helper paste-helper.swift -framework CoreGraphics -framework Cocoa -framework Foundation
echo "Built paste-helper"
