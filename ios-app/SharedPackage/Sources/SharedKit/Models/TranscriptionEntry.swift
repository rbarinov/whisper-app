import Foundation

public struct TranscriptionEntry: Identifiable, Codable, Equatable, Sendable {
    public let id: UUID
    public let timestamp: Date
    public let durationSeconds: Double
    public var text: String?
    public var rawText: String?
    public var status: TranscriptionStatus
    public var audioFilePath: String?
    public var errorMessage: String?

    public init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        durationSeconds: Double,
        text: String? = nil,
        rawText: String? = nil,
        status: TranscriptionStatus = .recording,
        audioFilePath: String? = nil,
        errorMessage: String? = nil
    ) {
        self.id = id
        self.timestamp = timestamp
        self.durationSeconds = durationSeconds
        self.text = text
        self.rawText = rawText
        self.status = status
        self.audioFilePath = audioFilePath
        self.errorMessage = errorMessage
    }
}
