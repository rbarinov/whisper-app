// Copyright (c) 2026 Roman Barinov. MIT License.

import Foundation

struct TranscriptionEntry: Identifiable, Codable, Equatable {
    let id: UUID
    let text: String
    let timestamp: Date
    let durationSeconds: Double

    init(text: String, durationSeconds: Double) {
        self.id = UUID()
        self.text = text
        self.timestamp = Date()
        self.durationSeconds = durationSeconds
    }
}
