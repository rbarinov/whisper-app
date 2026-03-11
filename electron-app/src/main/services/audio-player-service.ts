/**
 * Audio Playback Service
 * 
 * Tracks playback state (which entry is playing) and handles IPC communication.
 * The main process only manages state; actual audio playback happens in the renderer
 * process using HTML5 <audio> element via IPC messages.
 */

export interface AudioPlayerState {
  isPlaying: boolean;
  playingEntryId: string | null;
  playingFilePath: string | null;
}

export class AudioPlayerService {
  private state: AudioPlayerState = {
    isPlaying: false,
    playingEntryId: null,
    playingFilePath: null,
  };

  /**
   * Get the current playback state
   */
  getState(): AudioPlayerState {
    return { ...this.state };
  }

  /**
   * Start playing an entry
   */
  play(entryId: string, filePath: string): void {
    this.state = {
      isPlaying: true,
      playingEntryId: entryId,
      playingFilePath: filePath,
    };
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.state = {
      isPlaying: false,
      playingEntryId: null,
      playingFilePath: null,
    };
  }

  /**
   * Toggle playback of an entry:
   * - If currently playing THIS entry: stop
   * - Otherwise: stop current (if any) and play the new entry
   */
  toggle(entryId: string, filePath: string): void {
    if (this.state.isPlaying && this.state.playingEntryId === entryId) {
      // Currently playing this entry, stop it
      this.stop();
    } else {
      // Either not playing or playing a different entry, start the new one
      this.play(entryId, filePath);
    }
  }

  /**
   * Check if a specific entry is currently playing
   */
  isPlayingEntry(entryId: string): boolean {
    return this.state.isPlaying && this.state.playingEntryId === entryId;
  }
}

// Singleton instance
export const audioPlayerService = new AudioPlayerService();
