import Foundation
import SharedKit
import UIKit

enum KeyboardState: Equatable {
    case idle
    case requestingHostApp
    case waitingForResult
    case resultReady(text: String)
    case error(message: String)
}

final class KeyboardViewModel {
    private let storage = SharedStorage()
    private var pollTimer: Timer?
    private weak var inputViewController: UIInputViewController?

    var onStateChanged: ((KeyboardState) -> Void)?
    var onTextReady: ((String) -> Void)?

    var state: KeyboardState = .idle {
        didSet {
            onStateChanged?(state)
        }
    }

    func configure(inputViewController: UIInputViewController) {
        self.inputViewController = inputViewController
    }

    var latestTranscriptionText: String? {
        storage.loadLatestTranscription()?.text
    }

    func startRecording() {
        guard let vc = inputViewController, vc.hasFullAccess else {
            state = .error(message: "Enable Full Access in Settings")
            return
        }

        guard let url = URL(string: "whisperapp://record") else {
            state = .error(message: "Invalid URL scheme")
            return
        }

        storage.signalKeyboardRecordingRequest()

        state = .requestingHostApp

        var responder: UIResponder? = vc
        while let r = responder {
            if let app = r as? UIApplication {
                app.open(url, options: [:]) { [weak self] success in
                    if success {
                        self?.state = .waitingForResult
                        self?.startPolling()
                    } else {
                        self?.state = .error(message: "Could not open Whisper App")
                    }
                }
                return
            }
            responder = r.next
        }

        state = .error(message: "Could not open Whisper App")
    }

    func checkForExistingResult() {
        if let result = storage.loadLatestTranscription() {
            state = .resultReady(text: result.text)
        }
    }

    func startPolling() {
        stopPolling()

        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.pollForResult()
        }
    }

    private func pollForResult() {
        if let result = storage.loadLatestTranscription() {
            stopPolling()
            state = .resultReady(text: result.text)
            onTextReady?(result.text)
            return
        }

        if let hostState = storage.loadHostRecordingState() {
            if hostState == "error" {
                stopPolling()
                state = .error(message: "Host app encountered an error")
            }
        }
    }

    func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }

    func insertTranscription() {
        guard case .resultReady(let text) = state else { return }
        onTextReady?(text)
    }

    func clearResult() {
        storage.clearLatestTranscription()
        state = .idle
    }

    func reset() {
        stopPolling()
        state = .idle
    }

    func resumePollingIfNeeded() {
        if case .waitingForResult = state {
            startPolling()
        }
    }

    func suspendPolling() {
        stopPolling()
    }
}
