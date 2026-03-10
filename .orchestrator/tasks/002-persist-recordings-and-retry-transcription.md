# Task 002: Persist recordings and retry failed transcription

## Goal

Every finished recording should be saved locally before transcription upload starts, so the user can recover from network failures, inspect failed items in history, replay the audio, and manually retry transcription later.

## Problem

The current flow can lose useful work when upload or transcription fails. If the connection drops or the request fails at the wrong moment, the user may have no practical way to retry with the same audio. The history also does not clearly represent incomplete or failed transcription attempts.

## Expected behavior

- After the user finishes a recording, the app saves the audio locally to a persistent file before contacting the transcription server.
- The transcription history stores an entry for that recording even if transcription has not completed yet.
- Each history entry includes:
  - the path to the saved audio file;
  - the transcription status;
  - the transcription text when available;
  - enough metadata to retry later.
- Supported statuses should include at minimum:
  - `successful`;
  - `pending` or `not_sent` for recordings that exist locally but have not completed transcription yet;
  - `failed` for recordings whose upload or transcription ended with an error.
- If upload or transcription fails, the history entry remains visible instead of disappearing.
- From the history UI, the user can:
  - see successful and unsuccessful transcription items together;
  - replay the stored audio recording;
  - retry sending the saved recording to the transcription server.
- When retry succeeds, the existing history item updates to a successful state instead of creating confusing duplicates unless duplicate history items are intentionally part of the design.

## Acceptance criteria

- Every completed recording is persisted to a local file before transcription upload begins.
- History entries for saved recordings survive app restarts.
- Failed or incomplete items are visible in history with a clear status.
- A failed or pending item can be retried manually from history.
- Retrying uses the persisted local audio file instead of requiring a fresh recording.
- The user can play back the local audio for any history item that still has an accessible file.
- History storage includes both the transcription status and the local audio file path.
- Successful flows continue to work without regressions in paste behavior or normal transcription history.

## Data model implications

- Extend the transcription history model to store a local audio file path.
- Extend the history model to store a status enum or equivalent state field.
- Consider storing error details or last failure reason to improve debugging and UI messaging.
- Define whether retries update the same record or create retry attempt metadata linked to the original record.

## UI implications

- The history view should show status for each item.
- Failed and pending items should expose a retry action.
- Items with a local audio file should expose a play action.
- Error states should be understandable without opening logs.

## Notes for implementation

- Saving audio should happen before the network request starts, not after a successful upload.
- The app should define a dedicated storage directory for persisted recordings and handle cleanup policy explicitly.
- Retry logic can start as a manual retry from history, even if automatic retries remain limited.
- If automatic retry already exists, this feature still requires local persistence and user-controlled retry.
- Missing or deleted audio files should be handled gracefully in history.

## Status

pending
