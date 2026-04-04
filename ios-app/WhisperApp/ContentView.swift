import SwiftUI
import SharedKit
import AVFoundation

@MainActor
final class AppState: ObservableObject {
    @Published var recordingState: RecordingState = .idle
    @Published var isMicrophoneGranted: Bool = false
    @Published var history: [TranscriptionEntry] = []
    @Published var isAudioPlaying: Bool = false
    @Published var playingEntryId: UUID?
    @Published var settings: AppSettings = AppSettings()
    @Published var isKeyboardTriggeredRecording: Bool = false

    private let storage = SharedStorage()
    private let audioRecorder = AudioRecorderService()
    private let transcriptionProvider = OpenAITranscriptionProvider()
    private let llmProvider = OpenAILLMProvider()
    private let historyManager = HistoryService()
    private var activeEntryId: UUID?
    private var pipelineTask: Task<Void, Never>?

    init() {
        loadSettings()
        loadHistory()
        recoverInterruptedEntries()
    }

    var onboardingCompleted: Bool {
        settings.onboardingCompleted
    }

    func completeOnboarding() {
        settings.onboardingCompleted = true
        saveSettings()
    }

    func loadSettings() {
        if let loaded = try? storage.loadSettings() {
            settings = loaded
        }
        if let key = try? KeychainHelper.shared.loadString(key: "stt_api_key") {
            settings.apiKey = key
        }
        if let key = try? KeychainHelper.shared.loadString(key: "llm_api_key") {
            settings.llmApiKey = key
        }
    }

    func saveSettings() {
        var storable = settings
        storable.apiKey = ""
        storable.llmApiKey = ""
        try? storage.saveSettings(storable)
        try? KeychainHelper.shared.saveString(key: "stt_api_key", value: settings.apiKey)
        try? KeychainHelper.shared.saveString(key: "llm_api_key", value: settings.llmApiKey)
    }

    func loadHistory() {
        if let loaded = try? storage.loadHistory() {
            history = loaded
        }
    }

    func saveHistory() {
        try? storage.saveHistory(history)
    }

    func addToHistory(_ entry: TranscriptionEntry) {
        history.append(entry)
        if history.count > AppConstants.historyMaxEntries {
            let trimmed = history.dropFirst(history.count - AppConstants.historyMaxEntries)
            for entry in trimmed {
                if let path = entry.audioFilePath {
                    deleteAudioFile(path)
                }
            }
            history = Array(history.suffix(AppConstants.historyMaxEntries))
        }
        saveHistory()
    }

    func deleteFromHistory(_ id: UUID) {
        if let entry = history.first(where: { $0.id == id }) {
            if let path = entry.audioFilePath {
                deleteAudioFile(path)
            }
        }
        history.removeAll { $0.id == id }
        saveHistory()
    }

    func clearHistory() {
        for entry in history {
            if let path = entry.audioFilePath {
                deleteAudioFile(path)
            }
        }
        history.removeAll()
        saveHistory()
    }

    func updateInHistory(_ entry: TranscriptionEntry) {
        if let index = history.firstIndex(where: { $0.id == entry.id }) {
            history[index] = entry
            saveHistory()
        }
    }

    func updateHistoryEntry(id: UUID, _ transform: (inout TranscriptionEntry) -> Void) {
        if let index = history.firstIndex(where: { $0.id == id }) {
            transform(&history[index])
            saveHistory()
        }
    }

    func historyEntry(for id: UUID) -> TranscriptionEntry? {
        history.first { $0.id == id }
    }

    func loadAudioData(for relativePath: String) -> Data? {
        historyManager.loadAudioData(for: relativePath)
    }

    // MARK: - Recording Pipeline

    func startRecording() {
        guard case .idle = recordingState else { return }
        guard activeEntryId == nil else { return }

        let entry = TranscriptionEntry(durationSeconds: 0, status: .recording)
        activeEntryId = entry.id
        addToHistory(entry)

        do {
            try audioRecorder.startRecording()
            recordingState = .recording
        } catch {
            updateHistoryEntry(id: entry.id) { e in
                e.status = .failed
                e.errorMessage = error.localizedDescription
            }
            activeEntryId = nil
            recordingState = .error(message: error.localizedDescription)
        }
    }

    func stopRecording() {
        guard case .recording = recordingState, let entryId = activeEntryId else { return }

        guard let result = audioRecorder.stopRecording() else {
            cancelRecording()
            return
        }

        if result.duration < AppConstants.minRecordingDurationS {
            updateHistoryEntry(id: entryId) { e in
                e.status = .cancelled
                e.durationSeconds = result.duration
            }
            activeEntryId = nil
            recordingState = .idle
            return
        }

        let relativePath = historyManager.saveAudioFile(wavData: result.wavData, for: entryId)
        updateHistoryEntry(id: entryId) { e in
            e.status = .transcribing
            e.durationSeconds = result.duration
            if let path = relativePath {
                e.audioFilePath = path
            }
        }

        recordingState = .transcribing

        let wavData = result.wavData
        let currentSettings = settings

        pipelineTask = Task { [weak self] in
            await self?.runTranscriptionPipeline(
                entryId: entryId,
                wavData: wavData,
                settings: currentSettings
            )
        }
    }

    func cancelRecording() {
        audioRecorder.cancel()
        pipelineTask?.cancel()
        pipelineTask = nil

        if let entryId = activeEntryId {
            updateHistoryEntry(id: entryId) { e in
                if e.status == .recording || e.status == .transcribing || e.status == .processing {
                    e.status = .cancelled
                }
            }
        }

        activeEntryId = nil
        recordingState = .idle
    }

    func retryRecording(entryId: UUID) {
        guard let entry = historyEntry(for: entryId) else { return }
        guard entry.status == .failed || entry.status == .cancelled else { return }
        guard let relativePath = entry.audioFilePath else { return }
        guard let wavData = historyManager.loadAudioData(for: relativePath) else { return }

        activeEntryId = entryId
        recordingState = .transcribing

        updateHistoryEntry(id: entryId) { e in
            e.status = .transcribing
            e.errorMessage = nil
        }

        let currentSettings = settings

        pipelineTask = Task { [weak self] in
            await self?.runTranscriptionPipeline(
                entryId: entryId,
                wavData: wavData,
                settings: currentSettings
            )
        }
    }

    func requestMicrophonePermission() async -> Bool {
        let granted = await audioRecorder.requestPermission()
        isMicrophoneGranted = granted
        return granted
    }

    // MARK: - Private Pipeline

    private func runTranscriptionPipeline(
        entryId: UUID,
        wavData: Data,
        settings: AppSettings
    ) async {
        let transcriptionSettings = TranscriptionSettings(
            apiKey: settings.apiKey,
            apiBaseURL: settings.apiBaseURL,
            modelName: settings.modelName,
            language: settings.language
        )

        let rawText: String
        do {
            rawText = try await RetryService.retryWithBackoff {
                try await self.transcriptionProvider.transcribe(
                    audioData: wavData,
                    settings: transcriptionSettings
                )
            }
        } catch {
            if Task.isCancelled { return }
            await handlePipelineError(error, entryId: entryId)
            return
        }

        if Task.isCancelled { return }

        updateHistoryEntry(id: entryId) { e in
            e.rawText = rawText
        }

        if Task.isCancelled { return }

        var finalText = rawText
        var errorMessage: String?

        if settings.llmPostProcessingEnabled {
            updateHistoryEntry(id: entryId) { e in
                e.status = .processing
            }
            recordingState = .processing

            let llmSettings = LLMSettings(
                apiKey: settings.llmApiKey.isEmpty ? settings.apiKey : settings.llmApiKey,
                apiBaseURL: settings.llmApiBaseURL.isEmpty ? settings.apiBaseURL : settings.llmApiBaseURL,
                modelName: settings.llmModelName,
                systemPrompt: settings.llmSystemPrompt
            )

            do {
                var streamedText = ""
                let stream = llmProvider.processStream(text: rawText, settings: llmSettings)
                for try await token in stream {
                    if Task.isCancelled { return }
                    switch token {
                    case .content(let text):
                        streamedText += text
                    case .reasoning:
                        break
                    }
                }
                finalText = streamedText
            } catch {
                finalText = rawText
                errorMessage = "LLM failed: \(error.localizedDescription)"
            }
        }

        if Task.isCancelled { return }

        updateHistoryEntry(id: entryId) { e in
            e.status = .successful
            e.rawText = rawText
            e.text = finalText
            e.errorMessage = errorMessage
        }

        if settings.autoCopyToClipboard {
            UIPasteboard.general.string = finalText
        }
        storage.saveLatestTranscription(text: finalText, entryId: entryId)
        storage.saveHostRecordingState("idle")

        activeEntryId = nil
        recordingState = .idle
    }

    private func handlePipelineError(_ error: Error, entryId: UUID) async {
        let message = error.localizedDescription
        updateHistoryEntry(id: entryId) { e in
            e.status = .failed
            e.errorMessage = message
        }
        activeEntryId = nil
        recordingState = .error(message: message)
    }

    private func recoverInterruptedEntries() {
        var needsSave = false
        for i in history.indices {
            let status = history[i].status
            if status == .recording {
                history[i].status = .cancelled
                needsSave = true
            } else if status == .transcribing || status == .processing {
                history[i].status = .failed
                history[i].errorMessage = "Interrupted by app restart"
                needsSave = true
            }
        }
        if needsSave {
            saveHistory()
        }
    }

    private func deleteAudioFile(_ relativePath: String) {
        let dir = AudioRecorderService.recordingsDirectory()
        let url = dir.appendingPathComponent(relativePath)
        try? FileManager.default.removeItem(at: url)
    }
}

struct ContentView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            if appState.onboardingCompleted {
                MainTabView()
                    .onOpenURL { url in
                        handleURL(url)
                    }
            } else {
                OnboardingView()
            }
        }
    }

    private func handleURL(_ url: URL) {
        guard url.scheme == "whisperapp",
              let host = url.host,
              !host.isEmpty else { return }

        switch host {
        case "record":
            appState.isKeyboardTriggeredRecording = true
        default:
            break
        }
    }
}

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            RecordingView()
                .tabItem {
                    Label("Recording", systemImage: "mic.fill")
                }
                .tag(0)
            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                .tag(1)
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(2)
        }
    }
}

#Preview {
    ContentView()
}
