import Foundation

public final class SettingsService: @unchecked Sendable {
    public static let shared = SettingsService()

    private let defaults: UserDefaults
    private let keychain: KeychainHelper

    private enum Keys {
        static let settings = "app_settings"
    }

    private enum KeychainKeys {
        static let apiKey = "whisper_api_key"
        static let llmApiKey = "whisper_llm_api_key"
    }

    public init(
        suiteName: String = AppConstants.appGroupIdentifier,
        keychain: KeychainHelper = .shared
    ) {
        self.defaults = UserDefaults(suiteName: suiteName) ?? .standard
        self.keychain = keychain
    }

    public func load() -> AppSettings {
        guard let data = defaults.data(forKey: Keys.settings) else {
            return AppSettings()
        }

        guard var decoded = try? JSONDecoder().decode(AppSettings.self, from: data) else {
            return AppSettings()
        }

        if let apiKey = try? keychain.loadString(key: KeychainKeys.apiKey) {
            decoded.apiKey = apiKey
        }
        if let llmApiKey = try? keychain.loadString(key: KeychainKeys.llmApiKey) {
            decoded.llmApiKey = llmApiKey
        }

        return decoded
    }

    public func save(_ settings: AppSettings) throws {
        var storable = settings

        if !storable.apiKey.isEmpty {
            try keychain.saveString(key: KeychainKeys.apiKey, value: storable.apiKey)
            storable.apiKey = ""
        }

        if !storable.llmApiKey.isEmpty {
            try keychain.saveString(key: KeychainKeys.llmApiKey, value: storable.llmApiKey)
            storable.llmApiKey = ""
        }

        let data = try JSONEncoder().encode(storable)
        defaults.set(data, forKey: Keys.settings)
    }

    public func transcriptionSettings(from appSettings: AppSettings) -> TranscriptionSettings {
        TranscriptionSettings(
            apiKey: appSettings.apiKey,
            apiBaseURL: appSettings.apiBaseURL,
            modelName: appSettings.modelName,
            language: appSettings.language
        )
    }

    public func llmSettings(from appSettings: AppSettings) -> LLMSettings {
        LLMSettings(
            apiKey: appSettings.llmApiKey,
            apiBaseURL: appSettings.llmApiBaseURL,
            modelName: appSettings.llmModelName,
            systemPrompt: appSettings.llmSystemPrompt
        )
    }
}
