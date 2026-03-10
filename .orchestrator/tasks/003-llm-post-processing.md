# Task 003: LLM post-processing of transcription

## Goal

Allow the user to optionally send the raw Whisper transcription through an LLM (chat completion) to clean up, correct, translate, or otherwise improve the text before it is pasted into the active application.

## Problem

Whisper output is often imperfect: it may contain misheard words, poor punctuation, wrong language, or domain-specific terms that the model does not know. Currently the raw Whisper output is pasted as-is with no way to refine it.

## Expected behavior

- A new toggle in Settings enables or disables LLM post-processing.
- When enabled, after a successful Whisper transcription the app sends the raw text to the `/v1/chat/completions` endpoint (same base URL and API key as Whisper) with a user-configurable system prompt and the raw transcription as the user message.
- The user can configure the LLM model name (e.g. `gpt-4o-mini`) in a dedicated text field in Settings.
- The user can write any system prompt they want: fix grammar, translate to another language, apply a glossary of domain terms, etc. The glossary is simply part of the system prompt text — no separate field is needed.
- The LLM-processed text is what gets pasted into the active application and shown in the overlay.
- In the history list, both the raw Whisper transcription and the LLM-processed result are stored and visible, so the user can compare them and copy either version.
- During LLM processing, the overlay shows a distinct "processing" state (different from the "transcribing" state) so the user knows the extra step is happening.
- If LLM processing fails, the app falls back to using the raw Whisper transcription (paste it, show it in overlay) and records the error in the history entry.

## Acceptance criteria

- [ ] `AppSettings` has new `@Published` properties: `llmPostProcessingEnabled` (Bool, default `false`), `llmModelName` (String, default `"gpt-4o-mini"`), `llmSystemPrompt` (String, default `""`). These are persisted in `settings.json`.
- [ ] `SettingsView` has a new section "LLM Post-Processing" with a toggle, a model name text field, and a multi-line text editor for the system prompt. The section fields are disabled (greyed out) when the toggle is off.
- [ ] A new `LLMService` (or equivalent) sends a request to `{apiBaseURL}/v1/chat/completions` using the existing `apiKey`, sending `llmSystemPrompt` as the system message and the raw transcription as the user message, with `llmModelName` as the model parameter.
- [ ] `AppState` orchestrates the pipeline: Whisper transcription → (if enabled) LLM post-processing → paste + overlay + history.
- [ ] `TranscriptionEntry` gains an optional `rawText` field. When LLM post-processing is used, `rawText` stores the Whisper output and `text` stores the LLM result. When post-processing is off, `rawText` is `nil` and `text` is the Whisper output (backward compatible).
- [ ] `HistoryView` shows both raw and processed text when `rawText` is present (e.g. a disclosure group or a secondary label).
- [ ] The overlay shows a "processing…" indicator while the LLM request is in flight (visually distinct from the "transcribing…" indicator).
- [ ] On LLM failure, the raw Whisper text is used as the final result; the error is logged in the history entry but the user still gets their transcription.
- [ ] The LLM request has a reasonable timeout (e.g. 30s) and does not block the UI.
- [ ] Escape cancels the LLM processing step (same as it cancels transcription), falling back to raw text.

## Data model implications

`TranscriptionEntry` gets a new optional field:

```swift
var rawText: String?  // original Whisper output before LLM processing
```

`AppSettings.SettingsData` gets three new fields:

```swift
var llmPostProcessingEnabled: Bool
var llmModelName: String
var llmSystemPrompt: String
```

Existing `settings.json` files without these keys should load gracefully with defaults (`false`, `"gpt-4o-mini"`, `""`).

## UI implications

**SettingsView** — new "LLM Post-Processing" section below "API Configuration":

- Toggle: "Enable LLM post-processing"
- Text field: "Model" (placeholder: `gpt-4o-mini`)
- Multi-line text editor: "System Prompt" (placeholder text explaining usage, e.g. "Describe how the LLM should process the transcription. You can include a glossary of terms, ask for translation, grammar fixes, etc.")
- All fields except the toggle are disabled when the toggle is off.

**RecordingOverlayView** — new `.processing` state with a distinct icon/animation and label like "Processing…" (as opposed to "Transcribing…").

**HistoryView** — when an entry has `rawText != nil`, show both versions. For example, a disclosure group "Raw transcription" that expands to show the original Whisper text, with the main text being the LLM-processed result.

## Notes for implementation

- Use the same `apiBaseURL` and `apiKey` that are already configured for Whisper. The LLM endpoint is `{apiBaseURL}/v1/chat/completions`.
- The chat completion request body should follow the OpenAI-compatible format: `{"model": "...", "messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]}`.
- Consider reusing the retry logic from `TranscriptionService` or extracting a shared HTTP helper.
- The system prompt field can be large; use `TextEditor` rather than `TextField` in SwiftUI.
- Be mindful of `SettingsData: Codable` — new fields must have default values so that existing JSON files decode without error. Use `decodeIfPresent` or provide defaults in the `init(from:)` decoder.
- The overlay state machine in `RecordingOverlayView` currently has `.idle`, `.recording`, `.transcribing`, `.done(String)`, `.error(String)`. A new `.processing` case is needed.
- `AppState.stopRecordingAndTranscribe()` is the main integration point. After the Whisper call succeeds, check `settings.llmPostProcessingEnabled` and optionally chain the LLM call before proceeding to paste/overlay/history.

## Status

completed
