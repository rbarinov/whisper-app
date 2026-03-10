// Copyright (c) 2026 Roman Barinov. MIT License.

import SwiftUI

struct SettingsView: View {
    @ObservedObject var settings = AppSettings.shared
    @State private var isRecordingHotkey = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            Text("Settings")
                .font(.headline)
                .padding()

            Divider()

            Form {
                Section("API Configuration") {
                    TextField("Base URL", text: $settings.apiBaseURL)
                        .textFieldStyle(.roundedBorder)

                    SecureField("API Key", text: $settings.apiKey)
                        .textFieldStyle(.roundedBorder)

                    TextField("Model", text: $settings.modelName)
                        .textFieldStyle(.roundedBorder)

                    TextField("Language", text: $settings.language, prompt: Text("auto-detect"))
                        .textFieldStyle(.roundedBorder)

                    Text("Language: ISO-639-1 code (en, ru, de, etc). Leave empty for auto-detect.")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text("Endpoint: \(settings.apiBaseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/v1/audio/transcriptions")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Section("LLM Post-Processing") {
                    Toggle("Enable LLM post-processing", isOn: $settings.llmPostProcessingEnabled)

                    TextField("Model", text: $settings.llmModelName, prompt: Text(AppSettings.defaultLLMModelName))
                        .textFieldStyle(.roundedBorder)
                        .disabled(!settings.llmPostProcessingEnabled)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("System Prompt")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                            if settings.llmSystemPrompt != AppSettings.defaultLLMSystemPrompt {
                                Button("Reset to Default") {
                                    settings.llmSystemPrompt = AppSettings.defaultLLMSystemPrompt
                                }
                                .font(.caption)
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                                .disabled(!settings.llmPostProcessingEnabled)
                            }
                        }
                        TextEditor(text: $settings.llmSystemPrompt)
                            .font(.body)
                            .frame(minHeight: 80, maxHeight: 120)
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                            )
                            .disabled(!settings.llmPostProcessingEnabled)
                    }

                    Text("Describe how the LLM should process the transcription. You can include a glossary of terms, ask for translation, grammar fixes, etc.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Section("Hotkey") {
                    HStack {
                        Text("Current:")
                        Text(settings.hotkeyConfig.keyName)
                            .fontWeight(.medium)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(4)
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                            )

                        Spacer()

                        Button(isRecordingHotkey ? "Press any key..." : "Change") {
                            isRecordingHotkey.toggle()
                        }
                        .buttonStyle(.bordered)
                    }
                    .onHotkeyCapture(isActive: $isRecordingHotkey) { keyCode in
                        settings.hotkeyConfig = HotkeyConfig(
                            keyCode: keyCode,
                            keyName: HotkeyConfig.keyName(for: keyCode)
                        )
                        HotkeyManager.shared.restart()
                    }

                    if settings.hotkeyConfig != .defaultF5 {
                        Button("Reset to F5") {
                            settings.hotkeyConfig = .defaultF5
                            HotkeyManager.shared.restart()
                        }
                        .buttonStyle(.bordered)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Hold the key to record (release to transcribe)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text("Double-press to start recording, single press to stop")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Section("Permissions") {
                    HStack {
                        Image(systemName: AppState.shared.isMicrophoneGranted ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(AppState.shared.isMicrophoneGranted ? .green : .red)
                        Text("Microphone")
                        Spacer()
                        if !AppState.shared.isMicrophoneGranted {
                            Button("Grant") {
                                AppState.shared.requestMicrophonePermission()
                            }
                            .buttonStyle(.bordered)
                        }
                    }

                    HStack {
                        Image(systemName: HotkeyManager.shared.isAccessibilityGranted ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(HotkeyManager.shared.isAccessibilityGranted ? .green : .red)
                        Text("Accessibility")
                        Spacer()
                        if !HotkeyManager.shared.isAccessibilityGranted {
                            Button("Grant") {
                                HotkeyManager.shared.checkAccessibility()
                            }
                            .buttonStyle(.bordered)
                        }
                    }

                    HStack {
                        Image(systemName: HotkeyManager.shared.isEventTapRunning ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(HotkeyManager.shared.isEventTapRunning ? .green : .red)
                        Text("Event Tap")
                        Spacer()
                        if !HotkeyManager.shared.isEventTapRunning {
                            Button("Retry") {
                                HotkeyManager.shared.restart()
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }

                Section("Debug") {
                    Text(HotkeyManager.shared.lastEventDebug.isEmpty ? "Press any key to see events..." : HotkeyManager.shared.lastEventDebug)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .textSelection(.enabled)
                }
            }
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)
        }
        .frame(width: 400, height: 680)
    }
}

// MARK: - Hotkey capture modifier

struct HotkeyCaptureModifier: ViewModifier {
    @Binding var isActive: Bool
    var onCapture: (UInt16) -> Void

    func body(content: Content) -> some View {
        content
            .background(
                HotkeyCaptureView(isActive: $isActive, onCapture: onCapture)
                    .frame(width: 0, height: 0)
            )
    }
}

struct HotkeyCaptureView: NSViewRepresentable {
    @Binding var isActive: Bool
    var onCapture: (UInt16) -> Void

    func makeNSView(context: Context) -> HotkeyCaptureNSView {
        let view = HotkeyCaptureNSView()
        view.onCapture = { keyCode in
            self.onCapture(keyCode)
            DispatchQueue.main.async {
                self.isActive = false
            }
        }
        return view
    }

    func updateNSView(_ nsView: HotkeyCaptureNSView, context: Context) {
        if isActive {
            nsView.startCapturing()
        } else {
            nsView.stopCapturing()
        }
    }
}

class HotkeyCaptureNSView: NSView {
    var onCapture: ((UInt16) -> Void)?
    private var localMonitor: Any?
    private var globalMonitor: Any?

    func startCapturing() {
        stopCapturing()

        // Local monitor for key events when app is focused
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .systemDefined]) { [weak self] event in
            if event.type == .systemDefined && event.subtype.rawValue == 8 {
                // Media key event (F3-F6 on Apple Silicon, etc.)
                let data1 = event.data1
                let flags = (data1 & 0x0000FF00) >> 8
                let isDown = flags == 0x0A
                if isDown {
                    let mediaKeyCode = UInt32((data1 & 0xFFFF0000) >> 16)
                    // Reverse-map NX_KEYTYPE to our keycode using the known mapping
                    let nxToKeyCode: [UInt32: UInt16] = [
                        22: 176,  // NX_KEYTYPE_ILLUMINATION_DOWN → F5 (Apple Silicon)
                        23: 178,  // NX_KEYTYPE_ILLUMINATION_UP → F6 (Apple Silicon)
                        20: 98,   // Rewind → F7
                        16: 100,  // Play/Pause → F8
                        19: 101,  // Fast Forward → F9
                        7:  109,  // Mute → F10
                        1:  103,  // Volume Down → F11
                        0:  111,  // Volume Up → F12
                    ]
                    if let keyCode = nxToKeyCode[mediaKeyCode] {
                        self?.onCapture?(keyCode)
                        self?.stopCapturing()
                    }
                }
                return nil
            }
            self?.onCapture?(event.keyCode)
            self?.stopCapturing()
            return nil
        }

        // Global monitor for key events when app is in background
        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            self?.onCapture?(event.keyCode)
            self?.stopCapturing()
        }
    }

    func stopCapturing() {
        if let monitor = localMonitor {
            NSEvent.removeMonitor(monitor)
            self.localMonitor = nil
        }
        if let monitor = globalMonitor {
            NSEvent.removeMonitor(monitor)
            self.globalMonitor = nil
        }
    }

    deinit {
        stopCapturing()
    }
}

extension View {
    func onHotkeyCapture(isActive: Binding<Bool>, onCapture: @escaping (UInt16) -> Void) -> some View {
        modifier(HotkeyCaptureModifier(isActive: isActive, onCapture: onCapture))
    }
}
