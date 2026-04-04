import Foundation

public struct TranscriptionSettings: Sendable {
    public let apiKey: String
    public let apiBaseURL: String
    public let modelName: String
    public let language: String

    public init(apiKey: String, apiBaseURL: String, modelName: String, language: String) {
        self.apiKey = apiKey
        self.apiBaseURL = apiBaseURL
        self.modelName = modelName
        self.language = language
    }
}

public struct LLMSettings: Sendable {
    public let apiKey: String
    public let apiBaseURL: String
    public let modelName: String
    public let systemPrompt: String

    public init(apiKey: String, apiBaseURL: String, modelName: String, systemPrompt: String) {
        self.apiKey = apiKey
        self.apiBaseURL = apiBaseURL
        self.modelName = modelName
        self.systemPrompt = systemPrompt
    }
}

public protocol TranscriptionProvider: Sendable {
    func transcribe(audioData: Data, settings: TranscriptionSettings) async throws -> String
}

public protocol TranscriptionServiceProtocol: Sendable {
    func transcribe(audioURL: URL, settings: AppSettings) async throws -> String
}

public enum LLMStreamToken: Sendable {
    case content(String)
    case reasoning(String)
}

public protocol LLMProvider: Sendable {
    func process(text: String, settings: LLMSettings) async throws -> String
    func processStream(text: String, settings: LLMSettings) -> AsyncThrowingStream<LLMStreamToken, Error>
}

public protocol LLMServiceProtocol: Sendable {
    func postProcess(text: String, settings: AppSettings) async throws -> String
}

public protocol AudioRecorderProtocol: Sendable {
    func startRecording() async throws -> URL
    func stopRecording() async throws -> (url: URL, duration: TimeInterval)
}
