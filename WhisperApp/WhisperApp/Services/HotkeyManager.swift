// Copyright (c) 2026 Roman Barinov. MIT License.

import Carbon.HIToolbox
import Cocoa
import CoreGraphics
import Foundation

enum HotkeyAction {
    case holdStart
    case holdEnd
    case toggleOn
    case toggleOff
}

class HotkeyManager: ObservableObject {
    static let shared = HotkeyManager()

    @Published var isAccessibilityGranted = false
    @Published var isEventTapRunning = false
    @Published var lastEventDebug: String = ""

    var onAction: ((HotkeyAction) -> Void)?

    private var eventTap: CFMachPort?
    private var tapRunLoop: CFRunLoop?
    private var tapThread: Thread?

    // State machine (all accessed on main thread only)
    private var keyIsDown = false
    private var isToggleRecording = false
    private var lastKeyDownTime: Date?
    private var holdTimer: DispatchWorkItem?

    private let doublePressThreshold: TimeInterval = 0.4
    private let holdThreshold: TimeInterval = 0.3

    var targetKeyCode: UInt16 {
        AppSettings.shared.hotkeyConfig.keyCode
    }

    // NX_KEYTYPE mappings for media key fallback.
    // On some Mac models / configurations, F-keys arrive as NX_SYSDEFINED (CGEvent type 14)
    // instead of regular keyDown/keyUp. Both Apple Silicon and traditional keycodes mapped.
    private static let fKeyToNXKeyType: [UInt16: UInt32] = [
        // F3 — Mission Control / Exposé (NX_KEYTYPE = some value, but F3 on Apple Silicon
        // usually arrives as keyDown with code 160, so media fallback rarely needed)
        160:              10,  // F3 Apple Silicon
        UInt16(kVK_F3):  10,  // F3 traditional (99)

        // F4 — Launchpad / Dashboard
        177:              131, // F4 Apple Silicon
        UInt16(kVK_F4):  131, // F4 traditional (118)

        // F5 — Keyboard Brightness Down
        176:              22,  // F5 Apple Silicon — NX_KEYTYPE_ILLUMINATION_DOWN
        UInt16(kVK_F5):  22,  // F5 traditional (96)

        // F6 — Keyboard Brightness Up
        178:              23,  // F6 Apple Silicon — NX_KEYTYPE_ILLUMINATION_UP
        UInt16(kVK_F6):  23,  // F6 traditional (97)

        // F7-F12 — same keycodes on all Macs
        UInt16(kVK_F7):  20,  // Rewind
        UInt16(kVK_F8):  16,  // Play/Pause
        UInt16(kVK_F9):  19,  // Fast Forward
        UInt16(kVK_F10): 7,   // Mute
        UInt16(kVK_F11): 1,   // Volume Down
        UInt16(kVK_F12): 0,   // Volume Up
    ]

    func checkAccessibility() {
        let trusted = AXIsProcessTrusted()
        if !trusted {
            let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
            _ = AXIsProcessTrustedWithOptions(opts)
        }
        isAccessibilityGranted = trusted
    }

    func start() {
        checkAccessibility()
        startEventTapOnBackgroundThread()
    }

    func stop() {
        stopEventTap()
    }

    func restart() {
        stop()
        keyIsDown = false
        isToggleRecording = false
        lastKeyDownTime = nil
        holdTimer?.cancel()
        holdTimer = nil
        start()
    }

    // MARK: - Background thread for event tap

    private func startEventTapOnBackgroundThread() {
        stopEventTap()

        let thread = Thread {
            self.createAndRunEventTap()
        }
        thread.name = "com.whisperapp.keyboardService"
        thread.qualityOfService = .userInteractive
        tapThread = thread
        thread.start()
    }

    private func createAndRunEventTap() {
        // keyDown (10), keyUp (11), flagsChanged (12), NX_SYSDEFINED (14)
        let eventMask: CGEventMask =
            (1 << CGEventType.keyDown.rawValue) |
            (1 << CGEventType.keyUp.rawValue) |
            (1 << CGEventType.flagsChanged.rawValue) |
            (1 << 14)

        let refcon = Unmanaged.passUnretained(self).toOpaque()

        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: eventMask,
            callback: { _, type, event, refcon -> Unmanaged<CGEvent>? in
                guard let refcon = refcon else { return Unmanaged.passRetained(event) }
                let mgr = Unmanaged<HotkeyManager>.fromOpaque(refcon).takeUnretainedValue()
                return mgr.eventTapCallback(type: type, event: event)
            },
            userInfo: refcon
        ) else {
            DispatchQueue.main.async {
                self.isEventTapRunning = false
                self.lastEventDebug = "Event tap failed — grant Accessibility in System Settings"
            }
            return
        }

        self.eventTap = tap
        let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        self.tapRunLoop = CFRunLoopGetCurrent()
        CFRunLoopAddSource(self.tapRunLoop, runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)

        DispatchQueue.main.async {
            self.isEventTapRunning = true
            self.lastEventDebug = "Listening for keyCode \(self.targetKeyCode)"
        }

        CFRunLoopRun()
    }

    private func stopEventTap() {
        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: false)
            CFMachPortInvalidate(tap)
            eventTap = nil
        }
        if let rl = tapRunLoop {
            CFRunLoopStop(rl)
            tapRunLoop = nil
        }
        tapThread?.cancel()
        tapThread = nil
        isEventTapRunning = false
    }

    // MARK: - Unified event tap callback

    private func eventTapCallback(type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        // Re-enable if disabled by system
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap = eventTap {
                CGEvent.tapEnable(tap: tap, enable: true)
            }
            return Unmanaged.passRetained(event)
        }

        // PATH 1: NX_SYSDEFINED — media key events (fallback for some Mac models)
        if type.rawValue == 14 {
            return handleMediaKeyEvent(event)
        }

        // PATH 2: Normal keyDown / keyUp — primary path (works on Apple Silicon Macs)
        if type == .keyDown || type == .keyUp {
            return handleNormalKeyEvent(type: type, event: event)
        }

        return Unmanaged.passRetained(event)
    }

    // MARK: - Normal key events

    private func handleNormalKeyEvent(type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        let keyCode = UInt16(event.getIntegerValueField(.keyboardEventKeycode))

        DispatchQueue.main.async {
            self.lastEventDebug = "\(type == .keyDown ? "keyDown" : "keyUp") code=\(keyCode)"
        }

        guard keyCode == targetKeyCode else {
            return Unmanaged.passRetained(event)
        }

        let isAutoRepeat = event.getIntegerValueField(.keyboardEventAutorepeat) != 0
        if isAutoRepeat { return nil }

        let isDown = type == .keyDown
        DispatchQueue.main.async {
            if isDown { self.handleKeyDown() } else { self.handleKeyUp() }
        }
        return nil // consume the event
    }

    // MARK: - Media key events (NX_SYSDEFINED subtype 8)

    private func handleMediaKeyEvent(_ event: CGEvent) -> Unmanaged<CGEvent>? {
        guard let nsEvent = NSEvent(cgEvent: event),
              nsEvent.subtype.rawValue == 8 else {
            return Unmanaged.passRetained(event)
        }

        let data1 = nsEvent.data1
        let mediaKeyCode = UInt32((data1 & 0xFFFF0000) >> 16)
        let flags = UInt32((data1 & 0x0000FF00) >> 8)
        let isDown = flags == 0x0A
        let isUp = flags == 0x0B
        let isRepeat = (data1 & 0x1) != 0

        // Check if this media key matches our target
        guard let expectedNXType = Self.fKeyToNXKeyType[targetKeyCode],
              mediaKeyCode == expectedNXType else {
            return Unmanaged.passRetained(event)
        }

        DispatchQueue.main.async {
            self.lastEventDebug = "media key=\(mediaKeyCode) down=\(isDown)"
        }

        if isRepeat { return nil }

        DispatchQueue.main.async {
            if isDown { self.handleKeyDown() } else if isUp { self.handleKeyUp() }
        }
        return nil
    }

    // MARK: - State Machine

    private func handleKeyDown() {
        guard !keyIsDown else { return }
        keyIsDown = true

        let now = Date()

        if let last = lastKeyDownTime, now.timeIntervalSince(last) < doublePressThreshold {
            holdTimer?.cancel()
            holdTimer = nil
            lastKeyDownTime = nil

            if isToggleRecording {
                isToggleRecording = false
                onAction?(.toggleOff)
            } else {
                isToggleRecording = true
                onAction?(.toggleOn)
            }
        } else {
            lastKeyDownTime = now

            let timer = DispatchWorkItem { [weak self] in
                guard let self = self, self.keyIsDown else { return }
                self.holdTimer = nil  // Clear so handleKeyUp knows hold is active
                self.onAction?(.holdStart)
            }
            holdTimer?.cancel()
            holdTimer = timer
            DispatchQueue.main.asyncAfter(deadline: .now() + holdThreshold, execute: timer)
        }
    }

    private func handleKeyUp() {
        keyIsDown = false

        if let timer = holdTimer, !timer.isCancelled {
            timer.cancel()
            holdTimer = nil
        } else {
            if !isToggleRecording {
                onAction?(.holdEnd)
            }
        }
        holdTimer = nil
    }
}
