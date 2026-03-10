// Copyright (c) 2026 Roman Barinov. MIT License.

import AVFoundation
import Foundation

class AudioPlayerService: NSObject, ObservableObject, AVAudioPlayerDelegate {
    static let shared = AudioPlayerService()

    @Published var isPlaying = false
    @Published var playingEntryId: UUID?

    private var player: AVAudioPlayer?

    private override init() {
        super.init()
    }

    func play(url: URL, entryId: UUID) {
        // Stop any current playback first
        stop()

        guard FileManager.default.fileExists(atPath: url.path) else { return }

        do {
            player = try AVAudioPlayer(contentsOf: url)
            player?.delegate = self
            player?.play()
            isPlaying = true
            playingEntryId = entryId
        } catch {
            print("AudioPlayerService: failed to play \(url.lastPathComponent): \(error)")
            stop()
        }
    }

    func stop() {
        player?.stop()
        player = nil
        isPlaying = false
        playingEntryId = nil
    }

    func togglePlayback(url: URL, entryId: UUID) {
        if isPlaying && playingEntryId == entryId {
            stop()
        } else {
            play(url: url, entryId: entryId)
        }
    }

    // MARK: - AVAudioPlayerDelegate

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async {
            self.stop()
        }
    }
}
