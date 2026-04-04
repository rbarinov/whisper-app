import SwiftUI
import SharedKit
import AVFoundation

struct RecordingView: View {
    @EnvironmentObject private var appState: AppState
    @State private var transcribedText: String = ""
    @State private var processedText: String = ""
    @State private var isRecording: Bool = false
    @State private var showCopiedToast: Bool = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                stateIndicator

                recordButton
                    .padding(.vertical, 8)

                if !transcribedText.isEmpty {
                    transcriptionResult
                }

                Spacer()
            }
            .padding()
            .navigationTitle("WhisperApp")
        }
    }

    private var stateIndicator: some View {
        VStack(spacing: 8) {
            Text(stateLabel)
                .font(.headline)
                .foregroundStyle(stateColor)

            if isRecording || appState.recordingState == .transcribing || appState.recordingState == .processing {
                ProgressView()
                    .tint(stateColor)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appState.recordingState)
    }

    private var recordButton: some View {
        Button(action: toggleRecording) {
            ZStack {
                Circle()
                    .fill(isRecording ? Color.red.opacity(0.15) : Color.blue.opacity(0.1))
                    .frame(width: 120, height: 120)

                Circle()
                    .fill(isRecording ? Color.red : Color.blue)
                    .frame(width: isRecording ? 48 : 64)
                    .animation(.easeInOut(duration: 0.2), value: isRecording)

                if isRecording {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.white)
                        .frame(width: 24, height: 24)
                } else {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(.white)
                }
            }
        }
        .accessibilityLabel(isRecording ? "Stop recording" : "Start recording")
        .disabled(appState.recordingState != .idle && !isRecording)
    }

    private var transcriptionResult: some View {
        VStack(alignment: .leading, spacing: 12) {
            let hasProcessed = !processedText.isEmpty && processedText != transcribedText

            if hasProcessed {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Final")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text(processedText)
                        .font(.body)
                        .textSelection(.enabled)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 4) {
                    Text("Original")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text(transcribedText)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                Text(transcribedText)
                    .font(.body)
                    .textSelection(.enabled)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            HStack(spacing: 16) {
                Button {
                    copyText()
                } label: {
                    Label("Copy", systemImage: "doc.on.doc")
                }
                .buttonStyle(.bordered)

                Button {
                    transcribedText = ""
                    processedText = ""
                } label: {
                    Label("Clear", systemImage: "xmark.circle")
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(.horizontal)
    }

    private var stateLabel: String {
        switch appState.recordingState {
        case .idle: "Tap to record"
        case .recording: "Recording..."
        case .transcribing: "Transcribing..."
        case .processing: "Processing with LLM..."
        case .error(let message): "Error: \(message)"
        }
    }

    private var stateColor: Color {
        switch appState.recordingState {
        case .idle: .primary
        case .recording: .red
        case .transcribing: .blue
        case .processing: .orange
        case .error: .red
        }
    }

    private func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }

    private func startRecording() {
        guard case .idle = appState.recordingState else { return }
        isRecording = true
        appState.recordingState = .recording
    }

    private func stopRecording() {
        isRecording = false
        appState.recordingState = .idle
    }

    private func copyText() {
        let text = processedText.isEmpty ? transcribedText : processedText
        UIPasteboard.general.string = text
        showCopiedToast = true
    }
}

#Preview {
    RecordingView()
        .environmentObject(AppState())
}
