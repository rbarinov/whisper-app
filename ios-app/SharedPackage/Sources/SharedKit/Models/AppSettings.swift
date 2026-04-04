import Foundation

public struct AppSettings: Codable, Equatable, Sendable {
    public var apiBaseURL: String
    public var apiKey: String
    public var modelName: String
    public var language: String
    public var hotkeyConfig: HotkeyConfig
    public var cancelKeyConfig: HotkeyConfig
    public var llmPostProcessingEnabled: Bool
    public var llmApiBaseURL: String
    public var llmApiKey: String
    public var llmModelName: String
    public var llmSystemPrompt: String
    public var autoCopyToClipboard: Bool
    public var onboardingCompleted: Bool

    public init(
        apiBaseURL: String = AppConstants.defaultAPIBaseURL,
        apiKey: String = "",
        modelName: String = AppConstants.defaultModelName,
        language: String = "",
        hotkeyConfig: HotkeyConfig = HotkeyConfig(
            keyCode: AppConstants.defaultHotkeyKeyCode,
            keyName: AppConstants.defaultHotkeyKeyName
        ),
        cancelKeyConfig: HotkeyConfig = HotkeyConfig(
            keyCode: AppConstants.defaultCancelKeyCode,
            keyName: AppConstants.defaultCancelKeyName
        ),
        llmPostProcessingEnabled: Bool = false,
        llmApiBaseURL: String = "",
        llmApiKey: String = "",
        llmModelName: String = AppConstants.defaultLLMModelName,
        llmSystemPrompt: String = AppConstants.defaultLLMSystemPrompt,
        autoCopyToClipboard: Bool = true,
        onboardingCompleted: Bool = false
    ) {
        self.apiBaseURL = apiBaseURL
        self.apiKey = apiKey
        self.modelName = modelName
        self.language = language
        self.hotkeyConfig = hotkeyConfig
        self.cancelKeyConfig = cancelKeyConfig
        self.llmPostProcessingEnabled = llmPostProcessingEnabled
        self.llmApiBaseURL = llmApiBaseURL
        self.llmApiKey = llmApiKey
        self.llmModelName = llmModelName
        self.llmSystemPrompt = llmSystemPrompt
        self.autoCopyToClipboard = autoCopyToClipboard
        self.onboardingCompleted = onboardingCompleted
    }
}
