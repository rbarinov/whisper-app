// Copyright (c) 2026 Roman Barinov. MIT License.

import Foundation

enum TranscriptionStatus: String, Codable {
    case transcribing
    case successful
    case failed
    case cancelled
}

struct TranscriptionEntry: Identifiable, Codable, Equatable {
    let id: UUID
    let timestamp: Date
    let durationSeconds: Double

    var text: String?
    var rawText: String?  // original Whisper output before LLM processing
    var status: TranscriptionStatus
    var audioFilePath: String?
    var errorMessage: String?

    /// Create a new entry for a recording that is about to be transcribed.
    init(durationSeconds: Double, status: TranscriptionStatus, audioFilePath: String?) {
        self.id = UUID()
        self.timestamp = Date()
        self.durationSeconds = durationSeconds
        self.text = nil
        self.rawText = nil
        self.status = status
        self.audioFilePath = audioFilePath
        self.errorMessage = nil
    }

    /// Create an entry with a specific ID (used when the ID must match the audio filename).
    init(id: UUID, durationSeconds: Double, status: TranscriptionStatus, audioFilePath: String?) {
        self.id = id
        self.timestamp = Date()
        self.durationSeconds = durationSeconds
        self.text = nil
        self.rawText = nil
        self.status = status
        self.audioFilePath = audioFilePath
        self.errorMessage = nil
    }

    // MARK: - Backward-compatible decoding

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        durationSeconds = try container.decode(Double.self, forKey: .durationSeconds)

        // Old entries store `text` as non-optional String; new entries store it as optional.
        text = try container.decodeIfPresent(String.self, forKey: .text)
        rawText = try container.decodeIfPresent(String.self, forKey: .rawText)

        // Old entries have no status — treat them as successful.
        status = try container.decodeIfPresent(TranscriptionStatus.self, forKey: .status) ?? .successful

        audioFilePath = try container.decodeIfPresent(String.self, forKey: .audioFilePath)
        errorMessage = try container.decodeIfPresent(String.self, forKey: .errorMessage)
    }
}
