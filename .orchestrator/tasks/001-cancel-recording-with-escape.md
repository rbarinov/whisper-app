# Task 001: Cancel recording with Escape

## Goal

When recording is active in double-tap action button mode, pressing `Escape` should immediately stop recording and cancel the current flow before transcription starts.

## Problem

In double-tap mode, the user can enter a persistent recording state. At the moment, that flow needs a dedicated cancel path so the user can quickly abandon a recording without waiting for transcription or producing unwanted pasted text.

## Expected behavior

- Recording was started through the double-tap action button flow.
- While recording is active, the user presses `Escape`.
- The app stops the active recording immediately.
- The recorded audio is discarded.
- Transcription is not started.
- No text is pasted into the active application.
- The UI returns to the idle state.

## Acceptance criteria

- `Escape` only cancels when the app is currently recording in double-tap mode.
- Stopping via `Escape` does not trigger upload or transcription.
- History is not polluted by cancelled recordings.
- Overlay and menu bar state update consistently after cancellation.
- Existing start/stop behavior for other recording modes keeps working.

## Notes for implementation

- This likely touches the global key handling layer and the recording lifecycle in app state.
- The cancellation path should be distinct from the normal stop-and-transcribe path.
- If temporary audio files are created before cancellation completes, they should be cleaned up.

## Status

completed
