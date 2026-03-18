import Cocoa
import CoreGraphics
import Foundation

private enum PasteHelperError: Error {
    case eventSourceUnavailable
    case eventCreationFailed
}

private func simulateCommandV() throws {
    guard let source = CGEventSource(stateID: .hidSystemState) else {
        throw PasteHelperError.eventSourceUnavailable
    }

    guard let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 9, keyDown: true),
          let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 9, keyDown: false) else {
        throw PasteHelperError.eventCreationFailed
    }

    keyDown.flags = .maskCommand
    keyUp.flags = .maskCommand

    keyDown.post(tap: .cghidEventTap)
    keyUp.post(tap: .cghidEventTap)
}

do {
    try simulateCommandV()
    exit(EXIT_SUCCESS)
} catch PasteHelperError.eventSourceUnavailable {
    FileHandle.standardError.write(Data("Unable to create CGEvent source\n".utf8))
    exit(EXIT_FAILURE)
} catch PasteHelperError.eventCreationFailed {
    FileHandle.standardError.write(Data("Unable to create Command+V events\n".utf8))
    exit(EXIT_FAILURE)
} catch {
    FileHandle.standardError.write(Data("Unexpected paste helper failure: \(error)\n".utf8))
    exit(EXIT_FAILURE)
}
