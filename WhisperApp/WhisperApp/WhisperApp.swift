// Copyright (c) 2026 Roman Barinov. MIT License.

import SwiftUI

// Force setup as early as possible using a static initializer
private enum Bootstrap {
    static let shared: Void = {
        DispatchQueue.main.async {
            AppState.shared.setup()
        }
    }()
}

@main
struct WhisperApp: App {
    @StateObject private var appState = AppState.shared

    init() {
        _ = Bootstrap.shared
    }

    var body: some Scene {
        MenuBarExtra {
            MenuBarView()
        } label: {
            MenuBarLabel(recordingState: appState.recordingState)
        }
        .menuBarExtraStyle(.window)
    }
}

struct MenuBarLabel: View {
    let recordingState: RecordingState

    var body: some View {
        switch recordingState {
        case .recording:
            Image(systemName: "mic.fill")
                .symbolRenderingMode(.palette)
                .foregroundStyle(.red)
        case .transcribing:
            Image(systemName: "ellipsis.circle")
        default:
            Image(systemName: "mic")
        }
    }
}

// MARK: - Window Manager for opening separate windows

class WindowManager: NSObject, ObservableObject, NSWindowDelegate {
    static let shared = WindowManager()

    private var historyWindow: NSWindow?
    private var settingsWindow: NSWindow?

    private var openWindowCount = 0

    func showHistory() {
        if let window = historyWindow, window.isVisible {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let view = HistoryView()
        let hostingView = NSHostingView(rootView: view)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 500),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.contentView = hostingView
        window.title = "Transcription History"
        window.center()
        window.isReleasedWhenClosed = false
        window.delegate = self
        self.historyWindow = window

        windowDidOpen()
        window.makeKeyAndOrderFront(nil)
    }

    func showSettings() {
        if let window = settingsWindow, window.isVisible {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let view = SettingsView()
        let hostingView = NSHostingView(rootView: view)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 400, height: 520),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.contentView = hostingView
        window.title = "WhisperApp Settings"
        window.center()
        window.isReleasedWhenClosed = false
        window.delegate = self
        self.settingsWindow = window

        windowDidOpen()
        window.makeKeyAndOrderFront(nil)
    }

    // MARK: - Activation policy management

    private func windowDidOpen() {
        openWindowCount += 1
        if openWindowCount == 1 {
            NSApp.setActivationPolicy(.regular)
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    func windowWillClose(_ notification: Notification) {
        openWindowCount = max(openWindowCount - 1, 0)
        if openWindowCount == 0 {
            // Delay slightly so the close animation finishes
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                // Double-check no windows are visible
                if self.historyWindow?.isVisible != true && self.settingsWindow?.isVisible != true {
                    NSApp.setActivationPolicy(.accessory)
                }
            }
        }
    }
}
