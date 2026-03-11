
## [2026-03-11] Task 13: Audio Playback Service
- Main process: state tracking only (no actual audio)
- Renderer: HTML5 <audio> for actual playback via IPC
- toggle() handles: idle→play, playing-same→stop, playing-other→switch
- Service exports: AudioPlayerState interface, AudioPlayerService class, audioPlayerService singleton
- All 9 unit tests pass
- IPC channels: PLAY_AUDIO, STOP_AUDIO (already defined in ipc-channels.ts)
