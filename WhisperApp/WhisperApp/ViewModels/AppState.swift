// Copyright (c) 2026 Roman Barinov. MIT License.

import AVFoundation
import Combine
import Foundation
import SwiftUI

enum RecordingState: Equatable {
    case idle
    case recording
    case transcribing
    case processing
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
    private let recordingsDirectoryURL: URL
    private let overlay = OverlayWindowManager.shared
    private var transcriptionTask: Task<Void, Never>?

    /// The entry ID currently being transcribed (initial or retry).
    private var activeTranscriptionEntryId: UUID?

    private init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appDir = appSupport.appendingPathComponent("WhisperApp")
        try? FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)
        self.historyFileURL = appDir.appendingPathComponent("history.json")

        // Dedicated directory for persisted audio recordings
        self.recordingsDirectoryURL = appDir.appendingPathComponent("recordings")
        try? FileManager.default.createDirectory(at: recordingsDirectoryURL, withIntermediateDirectories: true)

        loadHistory()
        fixInterruptedEntries()

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

        // Allow Escape to cancel recording, transcription, or LLM processing in progress
        hotkeyManager.shouldCancelOnEscape = { [weak self] in
            guard let self = self else { return false }
            return self.recordingState == .recording || self.recordingState == .transcribing || self.recordingState == .processing
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

    // MARK: - Recording lifecycle

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
        guard let (tmpURL, duration) = recorder.stopRecording() else { return }
        recordingState = .transcribing
        overlay.show(state: .transcribing)

        // Persist audio to dedicated directory before starting transcription
        let entryId = UUID()
        let audioFileName = "\(entryId.uuidString).wav"
        let persistedURL = recordingsDirectoryURL.appendingPathComponent(audioFileName)
        let audioFilePath = copyAudioFile(from: tmpURL, to: persistedURL)

        // Create history entry immediately with .transcribing status
        let entry = TranscriptionEntry(id: entryId, durationSeconds: duration, status: .transcribing, audioFilePath: audioFilePath)
        history.insert(entry, at: 0)
        saveHistory()

        activeTranscriptionEntryId = entryId

        transcriptionTask = Task {
            do {
                let rawText = try await TranscriptionService.shared.transcribe(audioFileURL: persistedURL)

                // Check cancellation after Whisper completes
                guard !Task.isCancelled else { return }
                let isStillTranscribing = await MainActor.run { self.recordingState == .transcribing }
                guard isStillTranscribing else { return }

                // LLM post-processing (if enabled)
                if self.settings.llmPostProcessingEnabled {
                    await MainActor.run {
                        self.recordingState = .processing
                        self.overlay.show(state: .processing)
                    }

                    do {
                        let processedText = try await LLMService.shared.process(text: rawText)
                        await MainActor.run {
                            guard !Task.isCancelled, self.recordingState == .processing else { return }

                            self.updateEntry(id: entryId, status: .successful, text: processedText, rawText: rawText, errorMessage: nil)
                            self.recordingState = .idle
                            self.activeTranscriptionEntryId = nil

                            self.overlay.show(state: .done(processedText))
                            PasteService.shared.paste(processedText)
                        }
                    } catch {
                        // LLM failed — fallback to raw Whisper text
                        await MainActor.run {
                            guard !Task.isCancelled, self.recordingState == .processing else { return }

                            self.updateEntry(id: entryId, status: .successful, text: rawText, rawText: nil, errorMessage: "LLM processing failed: \(error.localizedDescription)")
                            self.recordingState = .idle
                            self.activeTranscriptionEntryId = nil

                            self.overlay.show(state: .done(rawText))
                            PasteService.shared.paste(rawText)
                        }
                    }
                } else {
                    // No LLM — original flow
                    await MainActor.run {
                        guard !Task.isCancelled, self.recordingState == .transcribing else { return }

                        self.updateEntry(id: entryId, status: .successful, text: rawText, errorMessage: nil)
                        self.recordingState = .idle
                        self.activeTranscriptionEntryId = nil

                        self.overlay.show(state: .done(rawText))
                        PasteService.shared.paste(rawText)
                    }
                }
            } catch {
                await MainActor.run {
                    guard !Task.isCancelled,
                          self.recordingState == .transcribing || self.recordingState == .processing else { return }

                    self.updateEntry(id: entryId, status: .failed, text: nil, errorMessage: error.localizedDescription)
                    self.recordingState = .error(error.localizedDescription)
                    self.activeTranscriptionEntryId = nil

                    self.overlay.show(state: .error(error.localizedDescription))
                }
            }
        }
    }

    func cancelRecording() {
        switch recordingState {
        case .recording:
            // Cancel active recording — stop mic, persist if long enough
            if let (tmpURL, duration) = recorder.stopRecording() {
                if duration >= 0.5 {
                    // Save the recording for later retry
                    let entryId = UUID()
                    let audioFileName = "\(entryId.uuidString).wav"
                    let persistedURL = recordingsDirectoryURL.appendingPathComponent(audioFileName)
                    let audioFilePath = copyAudioFile(from: tmpURL, to: persistedURL)

                    let entry = TranscriptionEntry(id: entryId, durationSeconds: duration, status: .cancelled, audioFilePath: audioFilePath)
                    history.insert(entry, at: 0)
                    saveHistory()
                } else {
                    // Too short — likely accidental, discard
                    try? FileManager.default.removeItem(at: tmpURL)
                }
            }
            recordingState = .idle
            overlay.show(state: .cancelled)

        case .transcribing, .processing:
            // Cancel in-flight transcription or LLM processing — entry already exists, mark as cancelled
            transcriptionTask?.cancel()
            transcriptionTask = nil
            if let entryId = activeTranscriptionEntryId {
                updateEntry(id: entryId, status: .cancelled, text: nil, errorMessage: nil)
                activeTranscriptionEntryId = nil
            }
            recordingState = .idle
            overlay.show(state: .cancelled)

        default:
            break
        }
    }

    // MARK: - Retry

    func retryTranscription(for entry: TranscriptionEntry) {
        guard entry.status == .failed || entry.status == .cancelled else { return }
        guard recordingState == .idle else { return }
        guard let audioFilePath = entry.audioFilePath else { return }

        let audioURL = audioFileURL(for: audioFilePath)
        guard FileManager.default.fileExists(atPath: audioURL.path) else { return }

        let entryId = entry.id
        updateEntry(id: entryId, status: .transcribing, text: nil, errorMessage: nil)
        recordingState = .transcribing
        activeTranscriptionEntryId = entryId
        overlay.show(state: .transcribing)

        transcriptionTask = Task {
            do {
                let rawText = try await TranscriptionService.shared.transcribe(audioFileURL: audioURL)

                guard !Task.isCancelled else { return }
                let isStillTranscribing = await MainActor.run { self.recordingState == .transcribing }
                guard isStillTranscribing else { return }

                // LLM post-processing on retry (if enabled)
                if self.settings.llmPostProcessingEnabled {
                    await MainActor.run {
                        self.recordingState = .processing
                        self.overlay.show(state: .processing)
                    }

                    do {
                        let processedText = try await LLMService.shared.process(text: rawText)
                        await MainActor.run {
                            guard !Task.isCancelled, self.recordingState == .processing else { return }
                            self.updateEntry(id: entryId, status: .successful, text: processedText, rawText: rawText, errorMessage: nil)
                            self.recordingState = .idle
                            self.activeTranscriptionEntryId = nil
                            self.overlay.show(state: .done(processedText))
                        }
                    } catch {
                        // LLM failed — fallback to raw text
                        await MainActor.run {
                            guard !Task.isCancelled, self.recordingState == .processing else { return }
                            self.updateEntry(id: entryId, status: .successful, text: rawText, rawText: nil, errorMessage: "LLM processing failed: \(error.localizedDescription)")
                            self.recordingState = .idle
                            self.activeTranscriptionEntryId = nil
                            self.overlay.show(state: .done(rawText))
                        }
                    }
                } else {
                    await MainActor.run {
                        guard !Task.isCancelled, self.recordingState == .transcribing else { return }
                        self.updateEntry(id: entryId, status: .successful, text: rawText, errorMessage: nil)
                        self.recordingState = .idle
                        self.activeTranscriptionEntryId = nil
                        self.overlay.show(state: .done(rawText))
                    }
                }
            } catch {
                await MainActor.run {
                    guard !Task.isCancelled,
                          self.recordingState == .transcribing || self.recordingState == .processing else { return }
                    self.updateEntry(id: entryId, status: .failed, text: nil, errorMessage: error.localizedDescription)
                    self.recordingState = .error(error.localizedDescription)
                    self.activeTranscriptionEntryId = nil
                    self.overlay.show(state: .error(error.localizedDescription))
                }
            }
        }
    }

    // MARK: - CRUD

    func updateEntry(id: UUID, status: TranscriptionStatus, text: String?, rawText: String? = nil, errorMessage: String?) {
        guard let index = history.firstIndex(where: { $0.id == id }) else { return }
        history[index].status = status
        history[index].text = text
        history[index].rawText = rawText
        history[index].errorMessage = errorMessage
        saveHistory()
    }

    func deleteEntry(_ entry: TranscriptionEntry) {
        // Delete the associated audio file
        if let audioFilePath = entry.audioFilePath {
            let url = audioFileURL(for: audioFilePath)
            try? FileManager.default.removeItem(at: url)
        }
        // Stop playback if playing this entry
        if AudioPlayerService.shared.playingEntryId == entry.id {
            AudioPlayerService.shared.stop()
        }
        history.removeAll { $0.id == entry.id }
        saveHistory()
    }

    func clearHistory() {
        // Stop any playback
        AudioPlayerService.shared.stop()
        // Delete all audio files
        for entry in history {
            if let audioFilePath = entry.audioFilePath {
                let url = audioFileURL(for: audioFilePath)
                try? FileManager.default.removeItem(at: url)
            }
        }
        history.removeAll()
        saveHistory()
    }

    func copyToClipboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
    }

    // MARK: - Audio file helpers

    /// Returns the full URL for an audio file given its relative path within the recordings directory.
    func audioFileURL(for relativePath: String) -> URL {
        return recordingsDirectoryURL.appendingPathComponent(relativePath)
    }

    /// Check if the audio file for an entry exists on disk.
    func isAudioAvailable(for entry: TranscriptionEntry) -> Bool {
        guard let audioFilePath = entry.audioFilePath else { return false }
        return FileManager.default.fileExists(atPath: audioFileURL(for: audioFilePath).path)
    }

    /// Copy audio from a temporary URL to the persistent location. Returns the relative path or nil on failure.
    private func copyAudioFile(from sourceURL: URL, to destinationURL: URL) -> String? {
        do {
            try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
            try? FileManager.default.removeItem(at: sourceURL)
            return destinationURL.lastPathComponent
        } catch {
            print("AppState: failed to persist audio file: \(error)")
            // Fall back: try to use the source directly (it's in /tmp, may not survive restart)
            return nil
        }
    }

    // MARK: - Persistence

    private func loadHistory() {
        guard let data = try? Data(contentsOf: historyFileURL),
              let entries = try? JSONDecoder().decode([TranscriptionEntry].self, from: data) else { return }
        self.history = entries
    }

    /// Mark any entries left in `.transcribing` state as `.failed` (app was interrupted).
    private func fixInterruptedEntries() {
        var changed = false
        for i in history.indices {
            if history[i].status == .transcribing {
                history[i].status = .failed
                history[i].errorMessage = "Interrupted by app restart"
                changed = true
            }
            // Note: .processing state is not persisted in TranscriptionStatus,
            // but transcribing entries that were mid-LLM would still be .transcribing
            // since we only update status to .successful/.failed after completion.
        }
        if changed {
            saveHistory()
        }
    }

    private func saveHistory() {
        // Keep last 100 entries
        if history.count > 100 {
            // Delete audio files for entries being trimmed
            for entry in history.suffix(from: 100) {
                if let audioFilePath = entry.audioFilePath {
                    let url = audioFileURL(for: audioFilePath)
                    try? FileManager.default.removeItem(at: url)
                }
            }
            history = Array(history.prefix(100))
        }
        guard let data = try? JSONEncoder().encode(history) else { return }
        try? data.write(to: historyFileURL, options: .atomic)
    }
}
