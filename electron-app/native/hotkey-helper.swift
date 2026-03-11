import Cocoa
import CoreGraphics
import Foundation

private final class HotkeyHelper {
    private static let fKeyToNXKeyType: [UInt16: UInt32] = [
        160: 10,
        99: 10,
        177: 131,
        118: 131,
        176: 22,
        96: 22,
        178: 23,
        97: 23,
        98: 20,
        100: 16,
        101: 19,
        109: 7,
        103: 1,
        111: 0,
    ]

    private static let escapeKeyCode: UInt16 = 53

    private var targetKeyCode: UInt16 = 176
    private var eventTap: CFMachPort?
    private var tapRunLoop: CFRunLoop?
    private var tapThread: Thread?
    private var shouldQuit = false

    private let ioQueue = DispatchQueue(label: "com.whisperapp.hotkey-helper.io")
    private let stateQueue = DispatchQueue(label: "com.whisperapp.hotkey-helper.state")

    private static var sharedRef: HotkeyHelper?

    func run() {
        Self.sharedRef = self
        installSignalHandlers()
        startStdinReader()
        startEventTapOnBackgroundThread()
        dispatchMain()
    }

    private func installSignalHandlers() {
        signal(SIGINT, SIG_IGN)
        signal(SIGTERM, SIG_IGN)

        let srcInt = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
        srcInt.setEventHandler { [weak self] in self?.quit() }
        srcInt.resume()

        let srcTerm = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
        srcTerm.setEventHandler { [weak self] in self?.quit() }
        srcTerm.resume()
    }

    private func startStdinReader() {
        let thread = Thread { [weak self] in
            guard let self else { return }
            while let line = readLine(strippingNewline: true) {
                self.handleStdinLine(line)
                if self.stateQueue.sync(execute: { self.shouldQuit }) { return }
            }
            DispatchQueue.main.async { [weak self] in self?.quit() }
        }
        thread.name = "com.whisperapp.hotkey-helper.stdin"
        thread.start()
    }

    private func handleStdinLine(_ line: String) {
        guard let data = line.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let cmd = json["cmd"] as? String else {
            return
        }

        switch cmd {
        case "setKeyCode":
            guard let code = json["keyCode"] as? Int, code >= 0, code <= Int(UInt16.max) else {
                emit(["type": "error", "message": "Invalid setKeyCode payload"])
                return
            }
            stateQueue.sync {
                targetKeyCode = UInt16(code)
            }
        case "quit":
            DispatchQueue.main.async { [weak self] in self?.quit() }
        default:
            emit(["type": "error", "message": "Unknown command: \(cmd)"])
        }
    }

    private func startEventTapOnBackgroundThread() {
        stopEventTap()

        let thread = Thread { [weak self] in
            self?.createAndRunEventTap()
        }
        thread.name = "com.whisperapp.hotkey-helper.tap"
        thread.qualityOfService = .userInteractive
        tapThread = thread
        thread.start()
    }

    private func createAndRunEventTap() {
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
                guard let refcon else { return Unmanaged.passRetained(event) }
                let helper = Unmanaged<HotkeyHelper>.fromOpaque(refcon).takeUnretainedValue()
                return helper.eventTapCallback(type: type, event: event)
            },
            userInfo: refcon
        ) else {
            emit(["type": "error", "message": "Event tap failed — grant Accessibility in System Settings"])
            DispatchQueue.main.async { [weak self] in self?.quit() }
            return
        }

        eventTap = tap
        let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        tapRunLoop = CFRunLoopGetCurrent()
        CFRunLoopAddSource(tapRunLoop, runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)

        emit(["type": "ready"])
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
    }

    private func eventTapCallback(type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap = eventTap {
                CGEvent.tapEnable(tap: tap, enable: true)
            }
            return Unmanaged.passRetained(event)
        }

        if type.rawValue == 14 {
            return handleMediaKeyEvent(event)
        }

        if type == .keyDown || type == .keyUp {
            return handleNormalKeyEvent(type: type, event: event)
        }

        return Unmanaged.passRetained(event)
    }

    private func handleNormalKeyEvent(type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        let keyCode = UInt16(event.getIntegerValueField(.keyboardEventKeycode))
        let isAutoRepeat = event.getIntegerValueField(.keyboardEventAutorepeat) != 0
        let currentTarget = stateQueue.sync { targetKeyCode }

        // Consume auto-repeat events for the hotkey to prevent macOS
        // from triggering dictation or other system shortcuts on long press.
        if keyCode == currentTarget && isAutoRepeat {
            return nil
        }

        // For non-auto-repeat events, skip emitting if it's a repeat
        if isAutoRepeat { return Unmanaged.passRetained(event) }

        if type == .keyDown {
            emit(["type": "keydown", "keyCode": Int(keyCode)])
        } else {
            emit(["type": "keyup", "keyCode": Int(keyCode)])
        }

        // Consume the hotkey event so macOS doesn't process it
        // (prevents dictation prompt, Exposé triggers, etc.)
        if keyCode == currentTarget {
            return nil
        }

        // Escape is always passed through (handled by the JS side)
        return Unmanaged.passRetained(event)
    }

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

        if isRepeat { return Unmanaged.passRetained(event) }

        if isDown {
            emit(["type": "media", "nxKeyType": Int(mediaKeyCode), "isDown": true])
        } else if isUp {
            emit(["type": "media", "nxKeyType": Int(mediaKeyCode), "isDown": false])
        }

        return Unmanaged.passRetained(event)
    }

    func expectedNXTypeForCurrentKey() -> UInt32? {
        let key = stateQueue.sync { targetKeyCode }
        return Self.fKeyToNXKeyType[key]
    }

    private func emit(_ json: [String: Any]) {
        ioQueue.sync {
            do {
                let data = try JSONSerialization.data(withJSONObject: json)
                if var line = String(data: data, encoding: .utf8) {
                    line.append("\n")
                    if let utf8 = line.data(using: .utf8) {
                        FileHandle.standardOutput.write(utf8)
                    }
                }
            } catch {
            }
        }
    }

    private func quit() {
        let alreadyQuitting = stateQueue.sync { () -> Bool in
            if shouldQuit { return true }
            shouldQuit = true
            return false
        }
        if alreadyQuitting { return }

        stopEventTap()
        exit(0)
    }
}

HotkeyHelper().run()
