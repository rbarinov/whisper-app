import Foundation

public enum RecordingState: Equatable, Sendable {
    case idle
    case recording
    case transcribing
    case processing
    case error(message: String)
}

public enum TranscriptionStatus: String, Codable, Sendable {
    case recording
    case transcribing
    case processing
    case successful
    case failed
    case cancelled
}

public enum OverlayState: Equatable, Sendable {
    case hidden
    case recording
    case transcribing
    case processing(text: String?, reasoning: String?)
    case done(text: String)
    case error(message: String)
    case cancelled
}

public enum HotkeyAction: String, Sendable {
    case holdStart
    case holdEnd
    case toggleOn
    case toggleOff
    case cancel
}
