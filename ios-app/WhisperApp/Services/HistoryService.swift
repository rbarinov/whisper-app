import Foundation
import SharedKit

final class HistoryService {
    private let recordingsDir: URL

    init() {
        let appGroupURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: AppConstants.appGroupIdentifier
        )!
        self.recordingsDir = appGroupURL.appendingPathComponent("recordings")
    }

    func saveAudioFile(wavData: Data, for entryId: UUID) -> String? {
        let fileName = "\(entryId.uuidString).wav"
        let fileURL = recordingsDir.appendingPathComponent(fileName)

        do {
            try FileManager.default.createDirectory(at: recordingsDir, withIntermediateDirectories: true)
            try wavData.write(to: fileURL)
            return fileName
        } catch {
            print("Failed to save audio file: \(error)")
            return nil
        }
    }

    func loadAudioData(for relativePath: String) -> Data? {
        let url = recordingsDir.appendingPathComponent(relativePath)
        return try? Data(contentsOf: url)
    }

    func deleteAudioFile(_ relativePath: String) {
        let url = recordingsDir.appendingPathComponent(relativePath)
        try? FileManager.default.removeItem(at: url)
    }
}
