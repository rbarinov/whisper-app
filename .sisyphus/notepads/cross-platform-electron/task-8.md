## [2026-03-11] Task 8: Transcription Service
- Uses Node built-in https/http (no external HTTP packages)
- Multipart built manually (no form-data package)
- Retry: 3 attempts, [500,1500,3000]ms, no 4xx except 408/429
- Timeout: 60s
- DI pattern: _setHttpClient() for test mocking — avoids vi.mock on http/https
- Buffer<ArrayBufferLike> type needed for captured body in tests (not Buffer<ArrayBuffer>)
- TranscriptionError has typed `code` field: NO_API_KEY, INVALID_URL, NETWORK_ERROR, API_ERROR, DECODING_ERROR
- URL protocol check picks http vs https module at request time
