// Copyright (c) 2026 Roman Barinov. MIT License.

import SwiftUI

struct HistoryView: View {
    @ObservedObject var appState = AppState.shared

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Transcription History")
                    .font(.headline)
                Spacer()
                if !appState.history.isEmpty {
                    Button("Clear All") {
                        appState.clearHistory()
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.red)
                    .font(.caption)
                }
            }
            .padding()

            Divider()

            if appState.history.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "text.bubble")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("No transcriptions yet")
                        .foregroundColor(.secondary)
                    Text("Use \(AppSettings.shared.hotkeyConfig.keyName) to start recording")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 1) {
                        ForEach(appState.history) { entry in
                            HistoryRow(entry: entry)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .frame(width: 420, height: 500)
    }
}

struct HistoryRow: View {
    let entry: TranscriptionEntry
    @State private var copied = false
    @ObservedObject var appState = AppState.shared
    @ObservedObject var audioPlayer = AudioPlayerService.shared

    private var isPlayingThis: Bool {
        audioPlayer.isPlaying && audioPlayer.playingEntryId == entry.id
    }

    private var hasAudio: Bool {
        appState.isAudioAvailable(for: entry)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Content area — depends on status
            contentView

            // Metadata + action buttons
            HStack(spacing: 6) {
                statusBadge

                Text(String(format: "%.1fs", entry.durationSeconds))
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Text(entry.timestamp, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                + Text(" ago")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                actionButtons
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(6)
        .padding(.horizontal, 8)
    }

    // MARK: - Content

    @ViewBuilder
    private var contentView: some View {
        switch entry.status {
        case .successful:
            VStack(alignment: .leading, spacing: 4) {
                if let text = entry.text {
                    Text(text)
                        .font(.body)
                        .lineLimit(4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let rawText = entry.rawText {
                    DisclosureGroup("Raw transcription") {
                        Text(rawText)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }

                if entry.status == .successful, let errorMsg = entry.errorMessage {
                    Text(errorMsg)
                        .font(.caption2)
                        .foregroundColor(.orange)
                        .lineLimit(2)
                }
            }

        case .transcribing:
            HStack(spacing: 8) {
                ProgressView()
                    .controlSize(.small)
                Text("Transcribing...")
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

        case .failed:
            VStack(alignment: .leading, spacing: 2) {
                Text("Transcription failed")
                    .font(.body)
                    .foregroundColor(.red)
                if let errorMessage = entry.errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

        case .cancelled:
            Text("Recording cancelled")
                .font(.body)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Status badge

    @ViewBuilder
    private var statusBadge: some View {
        switch entry.status {
        case .successful:
            Image(systemName: "checkmark.circle.fill")
                .font(.caption2)
                .foregroundColor(.green)
        case .transcribing:
            EmptyView()
        case .failed:
            Image(systemName: "xmark.circle.fill")
                .font(.caption2)
                .foregroundColor(.red)
        case .cancelled:
            Image(systemName: "minus.circle.fill")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Action buttons

    @ViewBuilder
    private var actionButtons: some View {
        // Play button — available if audio file exists
        if hasAudio {
            Button {
                guard let audioFilePath = entry.audioFilePath else { return }
                let url = appState.audioFileURL(for: audioFilePath)
                audioPlayer.togglePlayback(url: url, entryId: entry.id)
            } label: {
                Image(systemName: isPlayingThis ? "stop.fill" : "play.fill")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .foregroundColor(.accentColor)
            .help(isPlayingThis ? "Stop playback" : "Play recording")
        }

        // Retry button — available for failed and cancelled entries with audio
        if (entry.status == .failed || entry.status == .cancelled) && hasAudio {
            Button {
                appState.retryTranscription(for: entry)
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .foregroundColor(.orange)
            .help("Retry transcription")
        }

        // Copy button — available for successful entries with text
        if entry.status == .successful, let text = entry.text {
            Button {
                appState.copyToClipboard(text)
                copied = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    copied = false
                }
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                    Text(copied ? "Copied" : "Copy")
                }
                .font(.caption)
            }
            .buttonStyle(.plain)
            .foregroundColor(copied ? .green : .accentColor)
        }

        // Delete button — always available
        Button {
            appState.deleteEntry(entry)
        } label: {
            Image(systemName: "trash")
                .font(.caption)
        }
        .buttonStyle(.plain)
        .foregroundColor(.secondary)
    }
}
