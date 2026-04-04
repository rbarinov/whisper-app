import Foundation

public struct HotkeyModifiers: Codable, Equatable, Sendable {
    public var ctrl: Bool
    public var alt: Bool
    public var shift: Bool
    public var meta: Bool

    public init(
        ctrl: Bool = false,
        alt: Bool = false,
        shift: Bool = false,
        meta: Bool = false
    ) {
        self.ctrl = ctrl
        self.alt = alt
        self.shift = shift
        self.meta = meta
    }
}

public struct HotkeyConfig: Codable, Equatable, Sendable {
    public var keyCode: Int
    public var keyName: String
    public var modifiers: HotkeyModifiers?

    public init(
        keyCode: Int,
        keyName: String,
        modifiers: HotkeyModifiers? = nil
    ) {
        self.keyCode = keyCode
        self.keyName = keyName
        self.modifiers = modifiers
    }
}
