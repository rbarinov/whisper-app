// Copyright (c) 2026 Roman Barinov. MIT License.

import SwiftUI

struct MenuBarView: View {
    @ObservedObject var appState = AppState.shared
    @State private var errorExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            // Status
            statusSection
                .padding(.horizontal, 8)
                .padding(.top, 8)
                .padding(.bottom, 4)

            Divider()
                .padding(.vertical, 4)

            // Quick actions
            MenuBarButton(
                icon: appState.recordingState == .recording ? "stop.circle.fill" : "mic.circle.fill",
                iconColor: appState.recordingState == .recording ? .red : .accentColor,
                title: appState.recordingState == .recording ? "Stop Recording" : "Start Recording",
                shortcut: AppSettings.shared.hotkeyConfig.keyName
            ) {
                if appState.recordingState == .recording {
                    appState.stopRecordingAndTranscribe()
                } else if appState.recordingState == .idle {
                    appState.startRecording()
                }
            }

            Divider()
                .padding(.vertical, 4)

            // Last transcription preview
            if let last = appState.history.first {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Last recording:")
                        .font(.caption2)
                        .foregroundColor(.secondary)

                    lastEntryContent(last)

                    if last.status == .successful, let text = last.text {
                        MenuBarButton(icon: "doc.on.doc", title: "Copy to Clipboard") {
                            appState.copyToClipboard(text)
                        }
                    }

                    if (last.status == .failed || last.status == .cancelled),
                       appState.isAudioAvailable(for: last) {
                        MenuBarButton(icon: "arrow.clockwise", iconColor: .orange, title: "Retry Transcription") {
                            appState.retryTranscription(for: last)
                        }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)

                Divider()
                    .padding(.vertical, 4)
            }

            // Window buttons
            MenuBarButton(icon: "clock", title: "History") {
                dismissMenuBarPopover()
                WindowManager.shared.showHistory()
            }

            MenuBarButton(icon: "gear", title: "Settings") {
                dismissMenuBarPopover()
                WindowManager.shared.showSettings()
            }

            Divider()
                .padding(.vertical, 4)

            MenuBarButton(icon: "power", title: "Quit WhisperApp") {
                NSApplication.shared.terminate(nil)
            }
        }
        .padding(.vertical, 4)
        .frame(width: 300)
    }

    @ViewBuilder
    private func lastEntryContent(_ entry: TranscriptionEntry) -> some View {
        switch entry.status {
        case .successful:
            if let text = entry.text {
                Text(text)
                    .font(.system(.caption, design: .default))
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        case .transcribing:
            HStack(spacing: 6) {
                ProgressView().controlSize(.small)
                Text("Transcribing...")
                    .font(.system(.caption, design: .default))
                    .foregroundColor(.secondary)
            }
        case .failed:
            HStack(spacing: 4) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.red)
                    .font(.caption)
                Text(entry.errorMessage ?? "Transcription failed")
                    .font(.system(.caption, design: .default))
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .cancelled:
            HStack(spacing: 4) {
                Image(systemName: "minus.circle.fill")
                    .foregroundColor(.secondary)
                    .font(.caption)
                Text("Recording cancelled")
                    .font(.system(.caption, design: .default))
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func dismissMenuBarPopover() {
        // Standard way to close a MenuBarExtra .window-style popover
        NSApp.keyWindow?.close()
    }

    @ViewBuilder
    private var statusSection: some View {
        switch appState.recordingState {
        case .idle:
            HStack(spacing: 8) {
                Circle().fill(.green).frame(width: 8, height: 8)
                Text("Ready").font(.caption).foregroundColor(.secondary)
                Spacer()
            }

        case .recording:
            HStack(spacing: 8) {
                RecordingIndicator()
                Text("Recording...").font(.caption).foregroundColor(.red).fontWeight(.medium)
                Spacer()
            }

        case .transcribing:
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("Transcribing...").font(.caption).foregroundColor(.secondary)
                Spacer()
            }

        case .error(let message):
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.caption)
                    Text("Error")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.orange)
                    Spacer()
                    Button {
                        appState.recordingState = .idle
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                }

                Text(message)
                    .font(.caption)
                    .foregroundColor(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .padding(8)
            .background(Color.orange.opacity(0.1))
            .cornerRadius(6)
        }
    }
}

// MARK: - Reusable menu bar button with hover effect

struct MenuBarButton: View {
    let icon: String
    var iconColor: Color = .primary
    let title: String
    var shortcut: String? = nil
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(iconColor)
                    .frame(width: 16)
                Text(title)
                Spacer()
                if let shortcut = shortcut {
                    Text(shortcut)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .font(.system(.body, design: .default))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(isHovered ? Color.primary.opacity(0.1) : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 4)
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

// MARK: - Pulsing recording indicator

struct RecordingIndicator: View {
    @State private var isPulsing = false

    var body: some View {
        Circle()
            .fill(.red)
            .frame(width: 8, height: 8)
            .scaleEffect(isPulsing ? 1.3 : 1.0)
            .opacity(isPulsing ? 0.7 : 1.0)
            .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: isPulsing)
            .onAppear { isPulsing = true }
    }
}
