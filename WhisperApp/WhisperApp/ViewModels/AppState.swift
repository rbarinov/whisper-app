// Copyright (c) 2026 Roman Barinov. MIT License.

import AVFoundation
import Combine
import Foundation
import SwiftUI

enum RecordingState: Equatable {
    case idle
    case recording
    case transcribing
    case error(String)
}

class AppState: ObservableObject {
    static let shared = AppState()

    @Published var recordingState: RecordingState = .idle
    @Published var history: [TranscriptionEntry] = []

    let recorder = AudioRecorder()
    let hotkeyManager = HotkeyManager.shared
    let settings = AppSettings.shared

    private var cancellables = Set<AnyCancellable>()
    private let historyFileURL: URL
    private let overlay = OverlayWindowManager.shared
    private var transcriptionTask: Task<Void, Never>?

    private init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appDir = appSupport.appendingPathComponent("WhisperApp")
        try? FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)
        self.historyFileURL = appDir.appendingPathComponent("history.json")

        loadHistory()

        // Forward recorder state
        recorder.$isRecording
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isRecording in
                guard let self = self else { return }
                if isRecording && self.recordingState != .recording {
                    self.recordingState = .recording
                }
            }
            .store(in: &cancellables)

        // Handle hotkey actions
        hotkeyManager.onAction = { [weak self] action in
            self?.handleHotkeyAction(action)
        }

        // Allow Escape to cancel transcription in progress
        hotkeyManager.shouldCancelOnEscape = { [weak self] in
            guard let self = self else { return false }
            return self.recordingState == .recording || self.recordingState == .transcribing
        }

        // Auto-setup on init
        DispatchQueue.main.async { [weak self] in
            self?.setup()
        }
    }

    func setup() {
        requestMicrophonePermission()
        hotkeyManager.start()
    }

    private func requestMicrophonePermission() {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            break
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { _ in }
        case .denied, .restricted:
            DispatchQueue.main.async {
                self.recordingState = .error("Microphone access denied. Enable in System Settings > Privacy > Microphone.")
            }
        @unknown default:
            break
        }
    }

    private func handleHotkeyAction(_ action: HotkeyAction) {
        switch action {
        case .holdStart, .toggleOn:
            startRecording()
        case .holdEnd, .toggleOff:
            stopRecordingAndTranscribe()
        case .cancel:
            cancelRecording()
        }
    }

    func cancelRecording() {
        switch recordingState {
        case .recording:
            // Cancel active recording — stop mic, delete temp file
            if let (url, _) = recorder.stopRecording() {
                try? FileManager.default.removeItem(at: url)
            }
            recordingState = .idle
            overlay.show(state: .cancelled)

        case .transcribing:
            // Cancel in-flight transcription
            transcriptionTask?.cancel()
            transcriptionTask = nil
            recordingState = .idle
            overlay.show(state: .cancelled)

        default:
            break
        }
    }

    func startRecording() {
        guard recordingState != .recording else { return }
        guard AVCaptureDevice.authorizationStatus(for: .audio) == .authorized else {
            recordingState = .error("Microphone access not granted.")
            overlay.show(state: .error("Microphone access not granted"))
            return
        }
        recorder.startRecording()
        recordingState = .recording
        overlay.show(state: .recording)
    }

    func stopRecordingAndTranscribe() {
        guard let (url, duration) = recorder.stopRecording() else { return }
        recordingState = .transcribing
        overlay.show(state: .transcribing)

        transcriptionTask = Task {
            do {
                let text = try await TranscriptionService.shared.transcribe(audioFileURL: url)
                await MainActor.run {
                    // If cancelled while awaiting, discard the result
                    guard !Task.isCancelled, self.recordingState == .transcribing else { return }

                    let entry = TranscriptionEntry(text: text, durationSeconds: duration)
                    self.history.insert(entry, at: 0)
                    self.saveHistory()
                    self.recordingState = .idle

                    // Show transcribed text, then auto-dismiss
                    self.overlay.show(state: .done(text))

                    // Auto-paste into active field
                    PasteService.shared.paste(text)
                }
            } catch {
                await MainActor.run {
                    // Don't show error if we cancelled intentionally
                    guard !Task.isCancelled, self.recordingState == .transcribing else { return }

                    self.recordingState = .error(error.localizedDescription)
                    self.overlay.show(state: .error(error.localizedDescription))
                }
            }
        }
    }

    func deleteEntry(_ entry: TranscriptionEntry) {
        history.removeAll { $0.id == entry.id }
        saveHistory()
    }

    func clearHistory() {
        history.removeAll()
        saveHistory()
    }

    func copyToClipboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
    }

    // MARK: - Persistence

    private func loadHistory() {
        guard let data = try? Data(contentsOf: historyFileURL),
              let entries = try? JSONDecoder().decode([TranscriptionEntry].self, from: data) else { return }
        self.history = entries
    }

    private func saveHistory() {
        // Keep last 100 entries
        if history.count > 100 {
            history = Array(history.prefix(100))
        }
        guard let data = try? JSONEncoder().encode(history) else { return }
        try? data.write(to: historyFileURL, options: .atomic)
    }
}
