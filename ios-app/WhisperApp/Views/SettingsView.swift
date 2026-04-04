import SwiftUI
import SharedKit

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState

    private var settings: AppSettings {
        get { appState.settings }
        set { appState.settings = newValue; appState.saveSettings() }
    }

    var body: some View {
        NavigationStack {
            Form {
                sttSection
                llmSection
                aboutSection
            }
            .navigationTitle("Settings")
        }
    }

    private var sttSection: some View {
        Section {
            TextField("Base URL", text: Binding(
                get: { settings.apiBaseURL },
                set: { appState.settings.apiBaseURL = $0; appState.saveSettings() }
            ))
            .textContentType(.URL)
            .autocorrectionDisabled()
            .keyboardType(.URL)

            SecureField("API Key", text: Binding(
                get: { settings.apiKey },
                set: { appState.settings.apiKey = $0; appState.saveSettings() }
            ))
            .textContentType(.password)

            TextField("Model", text: Binding(
                get: { settings.modelName },
                set: { appState.settings.modelName = $0; appState.saveSettings() }
            ))
            .autocorrectionDisabled()

            Picker("Language", selection: Binding(
                get: { settings.language },
                set: { appState.settings.language = $0; appState.saveSettings() }
            )) {
                ForEach(LanguageOption.allCases, id: \.self) { option in
                    Text(option.label).tag(option.value)
                }
            }
        } header: {
            Text("Speech to Text")
        } footer: {
            Text("Configure your Whisper-compatible transcription endpoint.")
        }
    }

    private var llmSection: some View {
        Section {
            Toggle("Enable Post-Processing", isOn: Binding(
                get: { settings.llmPostProcessingEnabled },
                set: { appState.settings.llmPostProcessingEnabled = $0; appState.saveSettings() }
            ))

            if settings.llmPostProcessingEnabled {
                TextField("LLM Model", text: Binding(
                    get: { settings.llmModelName },
                    set: { appState.settings.llmModelName = $0; appState.saveSettings() }
                ))
                .autocorrectionDisabled()

                TextField("Custom Base URL", text: Binding(
                    get: { settings.llmApiBaseURL },
                    set: { appState.settings.llmApiBaseURL = $0; appState.saveSettings() }
                ))
                .textContentType(.URL)
                .autocorrectionDisabled()
                .keyboardType(.URL)

                SecureField("Custom API Key", text: Binding(
                    get: { settings.llmApiKey },
                    set: { appState.settings.llmApiKey = $0; appState.saveSettings() }
                ))
                .textContentType(.password)

                NavigationLink {
                    SystemPromptEditor(prompt: Binding(
                        get: { settings.llmSystemPrompt },
                        set: { appState.settings.llmSystemPrompt = $0; appState.saveSettings() }
                    ))
                } label: {
                    HStack {
                        Text("System Prompt")
                        Spacer()
                        Text(settings.llmSystemPrompt == AppConstants.defaultLLMSystemPrompt ? "Default" : "Custom")
                            .foregroundStyle(.secondary)
                            .font(.caption)
                    }
                }
            }
        } header: {
            Text("LLM Post-Processing")
        } footer: {
            if settings.llmPostProcessingEnabled {
                Text("Optional cleanup step after transcription. Leave base URL and API key blank to use the STT endpoint settings.")
            }
        }
    }

    private var aboutSection: some View {
        Section {
            HStack {
                Text("Version")
                Spacer()
                Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text("About")
        }
    }
}

private struct SystemPromptEditor: View {
    @Binding var prompt: String

    var body: some View {
        VStack(spacing: 0) {
            TextEditor(text: $prompt)
                .font(.system(.body, design: .monospaced))
                .padding()

            HStack {
                Spacer()
                Button("Reset to Default") {
                    prompt = AppConstants.defaultLLMSystemPrompt
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .padding()
            }
        }
        .navigationTitle("System Prompt")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private enum LanguageOption: String, CaseIterable {
    case auto
    case en
    case ru
    case de
    case fr
    case es
    case it
    case pt
    case uk
    case tr
    case zh
    case ja

    var value: String {
        rawValue == "auto" ? "" : rawValue
    }

    var label: String {
        switch self {
        case .auto: return "Auto"
        case .en: return "English"
        case .ru: return "Russian"
        case .de: return "German"
        case .fr: return "French"
        case .es: return "Spanish"
        case .it: return "Italian"
        case .pt: return "Portuguese"
        case .uk: return "Ukrainian"
        case .tr: return "Turkish"
        case .zh: return "Chinese"
        case .ja: return "Japanese"
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
}
