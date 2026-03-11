#!/bin/bash
set -e
cd "$(dirname "$0")"
swiftc -O -o hotkey-helper hotkey-helper.swift -framework CoreGraphics -framework Cocoa -framework Foundation
echo "Built hotkey-helper"
