import { describe, it, expect, beforeEach } from 'vitest';
import { AudioPlayerService } from '../../src/main/services/audio-player-service';

describe('AudioPlayerService', () => {
  let service: AudioPlayerService;

  beforeEach(() => {
    service = new AudioPlayerService();
  });

  // Test 1: Initial state
  it('should have initial state with isPlaying=false and null ids', () => {
    const state = service.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.playingEntryId).toBe(null);
    expect(state.playingFilePath).toBe(null);
  });

  // Test 2: play() sets state correctly
  it('should set isPlaying=true and store entryId when play() is called', () => {
    service.play('entry-123', '/path/to/audio.wav');
    const state = service.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.playingEntryId).toBe('entry-123');
    expect(state.playingFilePath).toBe('/path/to/audio.wav');
  });

  // Test 3: stop() clears state
  it('should set isPlaying=false and clear ids when stop() is called', () => {
    service.play('entry-123', '/path/to/audio.wav');
    service.stop();
    const state = service.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.playingEntryId).toBe(null);
    expect(state.playingFilePath).toBe(null);
  });

  // Test 4: toggle() when idle starts playback
  it('should start playback when toggle() is called while idle', () => {
    service.toggle('entry-A', '/path/to/A.wav');
    const state = service.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.playingEntryId).toBe('entry-A');
  });

  // Test 5: toggle() when playing the same entry stops it
  it('should stop playback when toggle() is called for the currently playing entry', () => {
    service.play('entry-A', '/path/to/A.wav');
    service.toggle('entry-A', '/path/to/A.wav');
    const state = service.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.playingEntryId).toBe(null);
  });

  // Test 6: toggle() when playing a different entry switches to the new one
  it('should switch to new entry when toggle() is called for a different entry', () => {
    service.play('entry-A', '/path/to/A.wav');
    service.toggle('entry-B', '/path/to/B.wav');
    const state = service.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.playingEntryId).toBe('entry-B');
    expect(state.playingFilePath).toBe('/path/to/B.wav');
  });

  // Test 7: isPlayingEntry() returns true for currently playing entry
  it('should return true when isPlayingEntry() is called for the currently playing entry', () => {
    service.play('entry-A', '/path/to/A.wav');
    expect(service.isPlayingEntry('entry-A')).toBe(true);
  });

  // Test 8: isPlayingEntry() returns false for different entry
  it('should return false when isPlayingEntry() is called for a different entry', () => {
    service.play('entry-A', '/path/to/A.wav');
    expect(service.isPlayingEntry('entry-B')).toBe(false);
  });

  // Test 9: isPlayingEntry() returns false when not playing
  it('should return false when isPlayingEntry() is called while not playing', () => {
    expect(service.isPlayingEntry('entry-A')).toBe(false);
  });
});
