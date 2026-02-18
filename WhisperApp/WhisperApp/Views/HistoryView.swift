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

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.text)
                .font(.body)
                .lineLimit(4)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack {
                Text(String(format: "%.1fs", entry.durationSeconds))
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                Button {
                    appState.copyToClipboard(entry.text)
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
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(6)
        .padding(.horizontal, 8)
    }
}
