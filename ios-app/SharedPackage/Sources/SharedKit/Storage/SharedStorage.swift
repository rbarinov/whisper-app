import Foundation

public final class SharedStorage {
    private let userDefaults: UserDefaults?

    public init() {
        self.userDefaults = UserDefaults(suiteName: AppConstants.appGroupIdentifier)
    }

    public func saveSettings(_ settings: AppSettings) throws {
        guard let userDefaults = userDefaults else {
            throw SharedStorageError.appGroupUnavailable
        }
        let data = try JSONEncoder().encode(settings)
        userDefaults.set(data, forKey: StorageKeys.settings)
    }

    public func loadSettings() throws -> AppSettings {
        guard let userDefaults = userDefaults,
              let data = userDefaults.data(forKey: StorageKeys.settings) else {
            return AppSettings()
        }
        return try JSONDecoder().decode(AppSettings.self, from: data)
    }

    public func saveHistory(_ entries: [TranscriptionEntry]) throws {
        guard let userDefaults = userDefaults else {
            throw SharedStorageError.appGroupUnavailable
        }
        let trimmed = Array(entries.suffix(AppConstants.historyMaxEntries))
        let data = try JSONEncoder().encode(trimmed)
        userDefaults.set(data, forKey: StorageKeys.history)
    }

    public func loadHistory() throws -> [TranscriptionEntry] {
        guard let userDefaults = userDefaults,
              let data = userDefaults.data(forKey: StorageKeys.history) else {
            return []
        }
        return try JSONDecoder().decode([TranscriptionEntry].self, from: data)
    }

    public func appendToHistory(_ entry: TranscriptionEntry) throws {
        var history = try loadHistory()
        history.append(entry)
        try saveHistory(history)
    }

    public func saveLatestTranscription(text: String, entryId: UUID) {
        userDefaults?.set(text, forKey: StorageKeys.latestTranscriptionText)
        userDefaults?.set(entryId.uuidString, forKey: StorageKeys.latestTranscriptionId)
    }

    public func loadLatestTranscription() -> (text: String, entryId: UUID?)? {
        guard let text = userDefaults?.string(forKey: StorageKeys.latestTranscriptionText),
              !text.isEmpty else {
            return nil
        }
        let idString = userDefaults?.string(forKey: StorageKeys.latestTranscriptionId)
        let entryId = idString.flatMap { UUID(uuidString: $0) }
        return (text, entryId)
    }

    public func clearLatestTranscription() {
        userDefaults?.removeObject(forKey: StorageKeys.latestTranscriptionText)
        userDefaults?.removeObject(forKey: StorageKeys.latestTranscriptionId)
    }

    public func signalKeyboardRecordingRequest() {
        userDefaults?.set(Date().timeIntervalSince1970, forKey: StorageKeys.keyboardRequestTimestamp)
    }

    public func loadKeyboardRequestTimestamp() -> TimeInterval? {
        userDefaults?.double(forKey: StorageKeys.keyboardRequestTimestamp)
    }

    public func saveHostRecordingState(_ state: String) {
        userDefaults?.set(state, forKey: StorageKeys.hostRecordingState)
    }

    public func loadHostRecordingState() -> String? {
        userDefaults?.string(forKey: StorageKeys.hostRecordingState)
    }
}

public enum SharedStorageError: Error, LocalizedError {
    case appGroupUnavailable

    public var errorDescription: String? {
        switch self {
        case .appGroupUnavailable:
            return "App Group container is not available"
        }
    }
}

private enum StorageKeys {
    static let settings = "app_settings"
    static let history = "transcription_history"
    static let latestTranscriptionText = "latest_transcription_text"
    static let latestTranscriptionId = "latest_transcription_id"
    static let keyboardRequestTimestamp = "keyboard_request_timestamp"
    static let hostRecordingState = "host_recording_state"
}
