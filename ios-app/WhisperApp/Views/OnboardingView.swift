import SwiftUI
import SharedKit
import AVFoundation

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState
    @State private var currentStep = 0
    @State private var microphonePermission: AVAudioApplication.recordPermission = .undetermined
    @State private var provider: ProviderChoice = .openai

    private enum ProviderChoice: String, CaseIterable {
        case openai
        case custom
    }

    private var steps: [StepID] {
        [.mic, .stt, .done]
    }

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.top, 20)
                .padding(.horizontal, 24)

            stepIndicator
                .padding(.vertical, 16)

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    stepContent
                }
                .padding(.horizontal, 24)
            }

            Spacer()

            navigationBar
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
        }
        .background(Color(.systemBackground))
        .task {
            microphonePermission = AVAudioApplication.shared.recordPermission
            if appState.settings.apiBaseURL.contains("openai.com") {
                provider = .openai
            } else if !appState.settings.apiBaseURL.isEmpty {
                provider = .custom
            }
        }
    }

    private var header: some View {
        HStack(spacing: 16) {
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.blue)
                .frame(width: 56, height: 56)
                .overlay {
                    Image(systemName: "mic.fill")
                        .font(.title2)
                        .foregroundStyle(.white)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text("WhisperApp")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                Text("Setup")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var stepIndicator: some View {
        HStack(spacing: 8) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, _ in
                Circle()
                    .fill(index <= currentStep ? Color.blue : Color.gray.opacity(0.3))
                    .frame(width: 8, height: 8)
            }
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        let step = steps[currentStep]

        switch step {
        case .mic:
            micStep
        case .stt:
            sttStep
        case .done:
            doneStep
        }
    }

    private var micStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Welcome to WhisperApp")
                    .font(.title2)
                    .fontWeight(.semibold)
                Text("Hold to record, release to transcribe. WhisperApp puts voice-to-text at your fingertips.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            permissionCard(
                title: "Microphone Access",
                description: "Required to capture your voice for transcription.",
                isGranted: microphonePermission == .granted
            ) {
                requestMicrophonePermission()
            }
        }
    }

    private var sttStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Speech to Text Provider")
                    .font(.title2)
                    .fontWeight(.semibold)
                Text("Choose your transcription backend and configure the connection.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Picker("Provider", selection: $provider) {
                Text("OpenAI").tag(ProviderChoice.openai)
                Text("Custom Server").tag(ProviderChoice.custom)
            }
            .pickerStyle(.segmented)

            if provider == .openai {
                VStack(alignment: .leading, spacing: 8) {
                    Text("API Key")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    SecureField("sk-...", text: Binding(
                        get: { appState.settings.apiKey },
                        set: { appState.settings.apiKey = $0; appState.settings.apiBaseURL = AppConstants.defaultAPIBaseURL; appState.saveSettings() }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.password)

                    Text("Get your API key at platform.openai.com/api-keys")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Base URL")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("https://your-server.com/v1", text: Binding(
                            get: { appState.settings.apiBaseURL },
                            set: { appState.settings.apiBaseURL = $0; appState.saveSettings() }
                        ))
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.URL)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("API Key")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        SecureField("your-api-key", text: Binding(
                            get: { appState.settings.apiKey },
                            set: { appState.settings.apiKey = $0; appState.saveSettings() }
                        ))
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.password)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Model")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("whisper-1", text: Binding(
                            get: { appState.settings.modelName },
                            set: { appState.settings.modelName = $0; appState.saveSettings() }
                        ))
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    }
                }
            }
        }
    }

    private var doneStep: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)

            Text("You're all set!")
                .font(.title)
                .fontWeight(.bold)

            Text("WhisperApp is configured and ready. You can always change these settings later.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var navigationBar: some View {
        HStack {
            if currentStep > 0 {
                Button("Back") {
                    withAnimation { currentStep -= 1 }
                }
                .buttonStyle(.bordered)
            }

            Spacer()

            if currentStep < steps.count - 1 {
                let step = steps[currentStep]
                let isDisabled = (step == .mic && microphonePermission != .granted)
                    || (step == .stt && appState.settings.apiKey.isEmpty)

                Button("Next") {
                    withAnimation { currentStep += 1 }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isDisabled)
            } else {
                Button("Get Started") {
                    appState.completeOnboarding()
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private func permissionCard(title: String, description: String, isGranted: Bool, action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(isGranted ? "Granted" : "Needed")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .textCase(.uppercase)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(isGranted ? Color.green.opacity(0.15) : Color.orange.opacity(0.15))
                    .foregroundStyle(isGranted ? .green : .orange)
                    .clipShape(Capsule())
            }

            if !isGranted {
                Button("Grant Access", action: action)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func requestMicrophonePermission() {
        AVAudioApplication.requestRecordPermission { granted in
            Task { @MainActor in
                microphonePermission = granted ? .granted : .denied
            }
        }
    }
}

private enum StepID {
    case mic
    case stt
    case done
}

#Preview {
    OnboardingView()
        .environmentObject(AppState())
}
