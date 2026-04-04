import SwiftUI
import SharedKit

struct HistoryView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            Group {
                if appState.history.isEmpty {
                    emptyState
                } else {
                    entryList
                }
            }
            .navigationTitle("History")
            .toolbar {
                if !appState.history.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Clear All", role: .destructive) {
                            appState.clearHistory()
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView(
            "No Transcriptions",
            systemImage: "mic.slash",
            description: Text("Record your first transcription to see it here.")
        )
    }

    private var entryList: some View {
        List {
            ForEach(appState.history.reversed()) { entry in
                HistoryRowView(entry: entry)
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            appState.deleteFromHistory(entry.id)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .swipeActions(edge: .leading) {
                        if entry.status == .failed || entry.status == .cancelled {
                            Button {
                                retryEntry(entry)
                            } label: {
                                Label("Retry", systemImage: "arrow.clockwise")
                            }
                            .tint(.orange)
                        }
                    }
            }
        }
        .listStyle(.plain)
    }

    private func retryEntry(_ entry: TranscriptionEntry) {
    }
}

private struct HistoryRowView: View {
    let entry: TranscriptionEntry
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            headerRow
            contentSection
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.easeInOut(duration: 0.2)) {
                isExpanded.toggle()
            }
        }
    }

    private var headerRow: some View {
        HStack {
            statusBadge

            Text(entry.timestamp, style: .relative)
                .font(.caption)
                .foregroundStyle(.secondary)

            if entry.durationSeconds > 0 {
                Text(String(format: "%.1fs", entry.durationSeconds))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if let text = displayText {
                Button {
                    UIPasteboard.general.string = text
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var contentSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            switch entry.status {
            case .successful:
                if let text = entry.text {
                    Text(text)
                        .font(.subheadline)
                        .lineLimit(isExpanded ? nil : 3)
                        .textSelection(.enabled)
                }
                if isExpanded, let raw = entry.rawText, raw != entry.text {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Original")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .textCase(.uppercase)
                        Text(raw)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            case .failed:
                Text("Transcription failed\(entry.errorMessage.map { ": \($0)" } ?? "")")
                    .font(.subheadline)
                    .foregroundStyle(.red)
                if isExpanded, let raw = entry.rawText {
                    Text(raw)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            case .cancelled:
                Text("Cancelled")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if isExpanded, let raw = entry.rawText {
                    Text(raw)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            case .recording:
                Text("Recording...")
                    .font(.subheadline)
                    .foregroundStyle(.blue)
            case .transcribing:
                Text("Transcribing...")
                    .font(.subheadline)
                    .foregroundStyle(.blue)
            case .processing:
                Text("Processing with LLM...")
                    .font(.subheadline)
                    .foregroundStyle(.orange)
            }
        }
    }

    private var statusBadge: some View {
        Text(statusLabel)
            .font(.caption2)
            .fontWeight(.semibold)
            .textCase(.uppercase)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(statusColor.opacity(0.15))
            .foregroundStyle(statusColor)
            .clipShape(Capsule())
    }

    private var statusLabel: String {
        switch entry.status {
        case .successful: "Done"
        case .failed: "Failed"
        case .cancelled: "Cancelled"
        case .recording: "Recording"
        case .transcribing: "Transcribing"
        case .processing: "Processing"
        }
    }

    private var statusColor: Color {
        switch entry.status {
        case .successful: .green
        case .failed: .red
        case .cancelled: .gray
        case .recording, .transcribing: .blue
        case .processing: .orange
        }
    }

    private var displayText: String? {
        switch entry.status {
        case .successful: entry.text ?? entry.rawText
        case .failed, .cancelled: entry.rawText
        default: nil
        }
    }
}

#Preview {
    HistoryView()
        .environmentObject(AppState())
}
