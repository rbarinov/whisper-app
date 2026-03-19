import Cocoa
import CoreGraphics
import Foundation

private enum PasteHelperError: Error {
    case accessibilityNotTrusted
    case appleScriptFailed
}

/// Simulates Cmd+V keystroke using AppleScript.
/// AppleScript is more reliable than CGEvent for cross-application keyboard simulation
/// because it properly handles custom keyboard layouts and doesn't require focus management.
private func simulateCommandV() throws {
    // Check accessibility permissions first
    guard AXIsProcessTrusted() else {
        throw PasteHelperError.accessibilityNotTrusted
    }
    
    let script = """
    tell application \"System Events\" to keystroke \"v\" using command down
    """
    
    guard let appleScript = NSAppleScript(source: script) else {
        throw PasteHelperError.appleScriptFailed
    }
    
    var errorDict: NSDictionary?
    appleScript.compileAndReturnError(&errorDict)
    if let error = errorDict {
        FileHandle.standardError.write(Data("AppleScript compile error: \(error)\n".utf8))
        throw PasteHelperError.appleScriptFailed
    }
    
    appleScript.executeAndReturnError(&errorDict)
    if let error = errorDict {
        FileHandle.standardError.write(Data("AppleScript execution error: \(error)\n".utf8))
        throw PasteHelperError.appleScriptFailed
    }
}

do {
    try simulateCommandV()
    exit(EXIT_SUCCESS)
} catch PasteHelperError.accessibilityNotTrusted {
    FileHandle.standardError.write(Data("Accessibility permission not granted\n".utf8))
    exit(EXIT_FAILURE)
} catch PasteHelperError.appleScriptFailed {
    FileHandle.standardError.write(Data("AppleScript paste failed\n".utf8))
    exit(EXIT_FAILURE)
} catch {
    FileHandle.standardError.write(Data("Unexpected paste helper failure: \(error)\n".utf8))
    exit(EXIT_FAILURE)
}
