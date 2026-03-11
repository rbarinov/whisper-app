# Cross-Platform WhisperApp — Electron Rewrite

## TL;DR

> **Quick Summary**: Rewrite WhisperApp as an Electron + React + Tailwind desktop app that runs on macOS (ARM64 + Intel), Windows (x64), and Linux (x64). Replaces the existing native Swift/SwiftUI app with a single cross-platform codebase. Full feature parity with the Swift app.
> 
> **Deliverables**:
> - Electron app in `electron-app/` directory within the existing monorepo
> - System tray app with global hotkey, audio recording, Whisper API transcription, LLM post-processing, auto-paste
> - Settings window, History window, floating overlay
> - CI/CD pipeline building for macOS (universal), Windows (NSIS), Linux (AppImage + deb + rpm)
> - Full test suite (Vitest unit tests + Playwright E2E)
> 
> **Estimated Effort**: XL
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: Task 1 → Task 3 → Task 7 → Task 10 → Task 14 → Task 18 → Task 22 → Final Verification

---

## Context

### Original Request
Rewrite the macOS-only WhisperApp (Swift/SwiftUI, ARM64-only) to work on Windows, Linux (Ubuntu and other distributions), and macOS Intel processors. The user chose to replace the native Swift app entirely with a single Electron cross-platform codebase.

### Interview Summary
**Key Discussions**:
- **Framework**: Electron (JS/TS) with React + Tailwind CSS for UI
- **macOS strategy**: Replace Swift app entirely — single Electron codebase for all platforms
- **Repository**: Monorepo — Electron app lives alongside the existing Swift code in `electron-app/`
- **Build tool**: electron-builder (production-proven by Mattermost, Standard Notes)
- **Wayland**: Clipboard-only fallback on Wayland (no keyboard simulation); auto-paste works on X11/Windows/macOS
- **Clipboard**: Simple overwrite (no save/restore)
- **Auto-update**: Not in v1 — users download from GitHub Releases manually
- **Migration**: Start fresh — no import of existing Swift app settings
- **Code signing**: None for v1 — document bypass steps (same as current Swift app)
- **Tests**: Full suite — Vitest unit tests + Playwright E2E

**Research Findings**:
- System tray: Built-in Electron `Tray` class, works cross-platform. GNOME requires AppIndicator extension.
- Global hotkeys: `uiohook-napi` for raw keyDown/keyUp events (hold-to-record + double-press detection)
- Auto-paste: `@nut-tree/nut-js` for Ctrl/Cmd+V simulation; clipboard-only fallback on Wayland
- Audio recording: Web Audio API (`getUserMedia` + `AudioWorklet`) → resample to 16kHz → manual WAV header encoding
- Overlay: Transparent `BrowserWindow` with `alwaysOnTop`, `focusable: false`, click-through
- Build: electron-builder with separate GitHub Actions jobs per OS (macOS, Windows, Ubuntu)
- Packaging: DMG universal (macOS), NSIS (Windows), AppImage + deb + rpm (Linux)

### Metis Review
**Identified Gaps** (addressed):
- **Wayland auto-paste broken**: Resolved — clipboard-only fallback on Wayland, with notification
- **Clipboard save/restore complexity**: Resolved — simple overwrite
- **Auto-update scope**: Resolved — deferred to v2
- **Code signing cost**: Resolved — none for v1
- **macOS migration**: Resolved — start fresh
- **uiohook-napi risk**: Addressed — spike task included as Wave 1 priority
- **Web Audio 16kHz resampling**: Addressed — explicit resampling task with verification
- **Processing state in UI**: Addressed — all 5 states explicitly handled (idle, recording, transcribing, processing, error)
- **LLM fallback to raw text**: Addressed — explicit guardrail (G7)
- **Cancel saves audio if ≥0.5s**: Addressed — explicit guardrail (G6)

---

## Work Objectives

### Core Objective
Build a cross-platform Electron desktop app that replicates all functionality of the existing macOS WhisperApp, running on macOS (ARM64 + Intel), Windows (x64), and Linux (x64).

### Concrete Deliverables
- `electron-app/` directory with complete Electron + React + Tailwind application
- `electron-app/package.json` with all dependencies and build configuration
- `electron-app/src/main/` — Electron main process (tray, hotkey, paste, overlay window management)
- `electron-app/src/renderer/` — React UI (settings, history, overlay, menu bar dropdown)
- `electron-app/src/shared/` — Shared types and constants
- `electron-app/tests/` — Vitest unit tests + Playwright E2E tests
- `.github/workflows/build-electron.yml` — CI build for all platforms
- `.github/workflows/release-electron.yml` — Release to GitHub Releases for all platforms
- Updated `README.md` with cross-platform install instructions

### Definition of Done
- [ ] `npm run build && npm run make` succeeds on macOS, Windows, Linux
- [ ] All Vitest tests pass: `npx vitest run`
- [ ] All Playwright E2E tests pass: `npx playwright test`
- [ ] App launches on all 3 platforms and shows tray icon
- [ ] Hold F5 → record → release → transcription pasted (macOS + Windows + Linux X11)
- [ ] Settings persist across app restart
- [ ] History persists across app restart with audio playback
- [ ] CI/CD builds and produces artifacts for all platforms

### Must Have
- System tray with dropdown menu showing status, start/stop recording, history, settings, quit
- Global hotkey (F5 default) with hold-to-record (≥300ms) and double-press toggle modes
- Audio recording at 16kHz mono 16-bit PCM WAV
- Whisper API transcription with 3-attempt retry, backoff [500ms, 1500ms, 3000ms]
- LLM post-processing via `/v1/chat/completions` with `reasoning_effort: "low"` and `<transcription>` tag wrapping
- Auto-paste on macOS (Cmd+V), Windows (Ctrl+V), Linux X11 (Ctrl+V); clipboard-only on Wayland
- Floating overlay with states: recording, transcribing, processing, done, error, cancelled
- Overlay auto-dismiss: done=3s, error=5s, cancelled=1.5s
- Settings window: API base URL, API key, model, language, hotkey, LLM toggle/model/system prompt
- History window: list entries (successful/failed/cancelled/transcribing), copy, delete, retry, play audio
- Audio playback from history
- Persistent settings as JSON in platform-appropriate `userData` directory
- Persistent history (max 100 entries) with audio files in `recordings/` subdirectory
- Escape key cancels recording (save audio if ≥0.5s) or cancels in-flight transcription/processing
- Hotkey capture UI in settings ("Press any key..." mode)
- Crash recovery: mark interrupted `.transcribing` entries as `.failed` on startup
- CI/CD: GitHub Actions building macOS universal, Windows NSIS, Linux AppImage+deb+rpm

### Must NOT Have (Guardrails)
- **G1**: Do NOT add auto-update / electron-updater — deferred to v2
- **G2**: Do NOT add code signing — v1 ships unsigned
- **G3**: Do NOT add launch-at-login functionality
- **G4**: Do NOT add audio input device selection — use system default
- **G5**: Do NOT add dark/light theme toggle — follow system theme only
- **G6**: Do NOT add OS-level notifications — overlay is the notification system
- **G7**: Do NOT add audio waveform visualization, drag-and-drop audio, export history, i18n
- **G8**: Do NOT add multiple API endpoints — single `apiBaseURL` for both Whisper and LLM
- **G9**: Do NOT modify the existing Swift/SwiftUI codebase — it stays intact in `WhisperApp/`
- **G10**: Do NOT import/migrate data from the Swift app — start fresh
- **G11**: Do NOT add max recording duration limits
- **G12**: Platform paste modifier must use `process.platform` detection, never hardcoded
- **G13**: Storage paths must use `app.getPath('userData')` only, never hardcoded OS paths
- **G14**: LLM request must include `"reasoning_effort": "low"` — non-standard but required
- **G15**: Default LLM model must be `gpt-oss-20b`, default system prompt character-for-character identical to Swift app
- **G16**: Retry logic: 3 attempts, delays [500ms, 1500ms, 3000ms], no retry on 4xx except 408/429
- **G17**: Cancel during recording: if ≥0.5s save audio + mark `.cancelled` (retryable); if <0.5s discard silently
- **G18**: LLM failure fallback: mark `.successful`, paste raw Whisper text, set `errorMessage` field
- **G19**: History schema backward-compatible: `status`, `rawText`, `audioFilePath` fields optional, default `status` to `"successful"` if missing

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (new project)
- **Automated tests**: YES — Tests alongside implementation
- **Framework**: Vitest (unit) + Playwright (E2E)
- **Each task** includes specific test files to create alongside implementation

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **UI components**: Playwright opens Electron app, navigates, interacts, asserts DOM, screenshots
- **Main process services**: Vitest unit tests — import, call, assert return values
- **IPC integration**: Playwright + IPC — renderer triggers action, main process responds
- **CLI/build**: Bash — run build commands, verify output files exist

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — scaffolding + shared types + spike):
├── Task 1: Electron project scaffolding with React + Tailwind [quick]
├── Task 2: Shared TypeScript types and constants [quick]
├── Task 3: Hotkey module spike — validate uiohook-napi on all platforms [deep]
├── Task 4: Vitest + Playwright test infrastructure setup [quick]
└── Task 5: Tailwind design tokens + base component library [visual-engineering]

Wave 2 (Core services — main process modules, MAX PARALLEL):
├── Task 6: Audio recording service (Web Audio API + WAV encoding) [deep]
├── Task 7: Hotkey manager (uiohook-napi state machine) [deep]
├── Task 8: Transcription service (Whisper API client with retry) [unspecified-high]
├── Task 9: LLM service (chat completions client with retry) [unspecified-high]
├── Task 10: Paste service (clipboard + keyboard simulation) [unspecified-high]
├── Task 11: Settings persistence service [quick]
├── Task 12: History persistence service [quick]
└── Task 13: Audio playback service [quick]

Wave 3 (UI + Integration — React views + main process orchestration):
├── Task 14: App state manager + IPC bridge (main ↔ renderer) [deep]
├── Task 15: System tray + tray menu (Electron Tray) [unspecified-high]
├── Task 16: Overlay window (transparent BrowserWindow) [visual-engineering]
├── Task 17: Menu bar dropdown view (React) [visual-engineering]
├── Task 18: Settings window (React form) [visual-engineering]
├── Task 19: History window (React list) [visual-engineering]
└── Task 20: Hotkey capture UI in settings [unspecified-high]

Wave 4 (Integration + Polish):
├── Task 21: Recording lifecycle integration (record → transcribe → LLM → paste) [deep]
├── Task 22: Cancel/retry/error handling integration [deep]
├── Task 23: macOS-specific polish (dock hide/show, universal binary) [unspecified-high]
└── Task 24: Linux-specific polish (Wayland fallback, AppIndicator) [unspecified-high]

Wave 5 (CI/CD + E2E):
├── Task 25: CI/CD build pipeline (GitHub Actions, 3 platforms) [unspecified-high]
├── Task 26: Release pipeline (GitHub Releases, all artifacts) [unspecified-high]
├── Task 27: E2E test suite (Playwright, full user flows) [deep]
└── Task 28: README update with cross-platform install guide [writing]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2-28 | 1 |
| 2 | — | 6-14, 21-22 | 1 |
| 3 | 1 | 7 | 1 |
| 4 | 1 | 27 | 1 |
| 5 | 1 | 16-20 | 1 |
| 6 | 1, 2 | 21 | 2 |
| 7 | 3 | 14, 20, 21 | 2 |
| 8 | 1, 2 | 14, 21 | 2 |
| 9 | 1, 2 | 14, 21 | 2 |
| 10 | 1, 2 | 14, 21 | 2 |
| 11 | 1, 2 | 14, 18 | 2 |
| 12 | 1, 2 | 14, 19 | 2 |
| 13 | 1, 2 | 19 | 2 |
| 14 | 7, 8, 9, 10, 11, 12 | 15, 16, 17, 21 | 3 |
| 15 | 14 | 21 | 3 |
| 16 | 5, 14 | 21 | 3 |
| 17 | 5, 14 | 21 | 3 |
| 18 | 5, 11, 14 | 20, 21 | 3 |
| 19 | 5, 12, 13, 14 | 21 | 3 |
| 20 | 7, 18 | 21 | 3 |
| 21 | 6, 14, 15, 16, 17 | 22, 23, 24 | 4 |
| 22 | 21 | 23, 24 | 4 |
| 23 | 22 | 25 | 4 |
| 24 | 22 | 25 | 4 |
| 25 | 23, 24 | 26 | 5 |
| 26 | 25 | 27 | 5 |
| 27 | 4, 21 | F1-F4 | 5 |
| 28 | 25, 26 | F1-F4 | 5 |

### Agent Dispatch Summary

- **Wave 1**: 5 tasks — T1→`quick`, T2→`quick`, T3→`deep`, T4→`quick`, T5→`visual-engineering`
- **Wave 2**: 8 tasks — T6→`deep`, T7→`deep`, T8→`unspecified-high`, T9→`unspecified-high`, T10→`unspecified-high`, T11→`quick`, T12→`quick`, T13→`quick`
- **Wave 3**: 7 tasks — T14→`deep`, T15→`unspecified-high`, T16→`visual-engineering`, T17→`visual-engineering`, T18→`visual-engineering`, T19→`visual-engineering`, T20→`unspecified-high`
- **Wave 4**: 4 tasks — T21→`deep`, T22→`deep`, T23→`unspecified-high`, T24→`unspecified-high`
- **Wave 5**: 4 tasks — T25→`unspecified-high`, T26→`unspecified-high`, T27→`deep`, T28→`writing`
- **FINAL**: 4 tasks — F1→`oracle`, F2→`unspecified-high`, F3→`unspecified-high`, F4→`deep`

---

## TODOs


> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

### Wave 1 — Foundation (5 tasks, all parallel)

- [x] 1. Electron Project Scaffolding with React + Tailwind

  **What to do**:
  - Initialize `electron-app/` with `npm init`, install: `electron`, `electron-builder`, `react`, `react-dom`, `tailwindcss`, `postcss`, `autoprefixer`, `typescript`, `@types/react`, `@types/react-dom`, `ts-loader`, `webpack`, `webpack-cli`, `html-webpack-plugin`, `css-loader`, `style-loader`, `postcss-loader`
  - Configure TypeScript (`tsconfig.json` strict mode, separate `tsconfig.main.json` and `tsconfig.renderer.json`)
  - Configure Webpack for renderer (React + Tailwind + TS)
  - Configure Tailwind CSS (`tailwind.config.js`, `postcss.config.js`)
  - Create directory structure: `src/main/` (main.ts, preload.ts, services/), `src/renderer/` (index.html, index.tsx, App.tsx, styles/, components/, views/), `src/shared/` (types.ts), `tests/` (unit/, e2e/), `assets/icons/`
  - Create minimal `main.ts`: BrowserWindow (hidden), load renderer HTML, `app.dock.hide()` on macOS
  - Create minimal `preload.ts` with `contextBridge.exposeInMainWorld` stub
  - Create minimal `App.tsx` rendering "WhisperApp" text
  - Add npm scripts: `dev`, `build`, `make`
  - Configure `electron-builder.yml` with basic app metadata (no signing)

  **Must NOT do**: No application logic. No native modules (uiohook, nut-js). No signing config.

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 (parallel with T2-T5) | **Blocks**: T2-T28 | **Blocked By**: None

  **References**:
  - `WhisperApp/WhisperApp/WhisperApp.swift` — Entry point pattern (bootstrap, dock hiding) to replicate in `main.ts`
  - `build.sh` — Current build flow; understand what `npm run make` replaces
  - electron-builder config docs: https://www.electron.build/configuration

  **Acceptance Criteria**:
  - [ ] `cd electron-app && npm install` succeeds
  - [ ] `cd electron-app && npm run build` produces webpack bundle in `dist/`
  - [ ] `cd electron-app && npx tsc --noEmit` exits 0
  - [ ] Directory structure matches spec

  **QA Scenarios:**
  ```
  Scenario: Build produces valid bundle
    Tool: Bash
    Steps: 1. `cd electron-app && npm run build` 2. Assert exit 0 3. Assert dist/ has index.html + .js bundle 4. `npx tsc --noEmit` exits 0
    Expected: Webpack bundle created, TypeScript compiles
    Evidence: .sisyphus/evidence/task-1-build.txt

  Scenario: Package structure correct
    Tool: Bash
    Steps: Verify src/main/main.ts, src/main/preload.ts, src/renderer/index.tsx, src/renderer/App.tsx, src/shared/types.ts exist. Verify package.json has dev/build/make scripts.
    Expected: All files present, scripts defined
    Evidence: .sisyphus/evidence/task-1-structure.txt
  ```

  **Commit**: YES — `feat(electron): scaffold Electron + React + Tailwind project`

- [x] 2. Shared TypeScript Types and Constants

  **What to do**:
  - Create `src/shared/types.ts`: `RecordingState` (idle/recording/transcribing/processing/error), `TranscriptionStatus` (transcribing/successful/failed/cancelled), `TranscriptionEntry` interface, `HotkeyConfig`, `AppSettings`, `OverlayState` (hidden/recording/transcribing/processing/done/error/cancelled), `HotkeyAction` (holdStart/holdEnd/toggleOn/toggleOff/cancel)
  - Create `src/shared/constants.ts`: All defaults character-for-character from Swift app. `DEFAULT_API_BASE_URL='https://api.openai.com'`, `DEFAULT_MODEL_NAME='whisper-1'`, `DEFAULT_LLM_MODEL_NAME='gpt-oss-20b'` (G15), `DEFAULT_LLM_SYSTEM_PROMPT` = exact copy from `AppSettings.swift:105-113`, `MAX_RETRIES=3`, `RETRY_DELAYS_MS=[500,1500,3000]`, `WHISPER_TIMEOUT_MS=60000`, `LLM_TIMEOUT_MS=30000`, `HISTORY_MAX_ENTRIES=100`, `DOUBLE_PRESS_THRESHOLD_MS=400`, `HOLD_THRESHOLD_MS=300`, `OVERLAY_DISMISS_DONE_MS=3000`, `OVERLAY_DISMISS_ERROR_MS=5000`, `OVERLAY_DISMISS_CANCELLED_MS=1500`, `MIN_RECORDING_DURATION_S=0.5`
  - Create `src/shared/ipc-channels.ts`: All IPC channel names as `const` object (START_RECORDING, STOP_RECORDING, CANCEL_RECORDING, GET_SETTINGS, SAVE_SETTINGS, GET_HISTORY, DELETE_ENTRY, CLEAR_HISTORY, RETRY_TRANSCRIPTION, COPY_TO_CLIPBOARD, PLAY_AUDIO, STOP_AUDIO, START_HOTKEY_CAPTURE, SHOW_SETTINGS, SHOW_HISTORY, QUIT_APP, STATE_UPDATE, OVERLAY_UPDATE, HOTKEY_CAPTURED)

  **Must NOT do**: No implementation logic. No Electron API imports (shared must work in both processes).

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []
  **Parallelization**: Wave 1 | **Blocks**: T6-T14 | **Blocked By**: T1

  **References**:
  - `WhisperApp/WhisperApp/Models/AppSettings.swift:97-203` — Settings fields + exact default values
  - `WhisperApp/WhisperApp/Models/TranscriptionEntry.swift:5-65` — Entry schema to match exactly
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:8-14` — RecordingState enum
  - `WhisperApp/WhisperApp/Views/RecordingOverlayView.swift:7-15` — OverlayState enum
  - `WhisperApp/WhisperApp/Services/HotkeyManager.swift:8-14` — HotkeyAction enum

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` passes
  - [ ] `DEFAULT_LLM_SYSTEM_PROMPT` contains 'You are a post-processor of transcribed audio' (character-for-character match with Swift)
  - [ ] `DEFAULT_LLM_MODEL_NAME` === `'gpt-oss-20b'`

  **QA Scenarios:**
  ```
  Scenario: Constants match Swift app values
    Tool: Bash
    Steps: 1. `npx tsc --noEmit` → exit 0. 2. Grep constants.ts for 'gpt-oss-20b'. 3. Grep for RETRY_DELAYS. 4. Grep for 'post-processor of transcribed audio'
    Expected: All values present and correct
    Evidence: .sisyphus/evidence/task-2-constants.txt
  ```

  **Commit**: YES — `feat(electron): add shared TypeScript types and constants`

- [x] 3. Hotkey Module Spike — Validate uiohook-napi

  **What to do**:
  - Install `uiohook-napi` in `electron-app/`
  - Create `spikes/hotkey-spike.ts`: starts uiohook listener, logs keyDown/keyUp with keycode+timestamp, detects F5 hold duration, detects double-press within 400ms, filters auto-repeat, detects Escape
  - Run spike and document in `spikes/HOTKEY_SPIKE_RESULTS.md`: F5 keycode on current platform, keyDown/keyUp reliability, auto-repeat distinguishability, unfocused capture, Escape detection
  - If uiohook-napi FAILS: document failure, evaluate `globalShortcut` + state machine as degraded fallback

  **Must NOT do**: No full state machine. No app integration. Standalone spike only.

  **Recommended Agent Profile**: **Category**: `deep` | **Skills**: []
  **Parallelization**: Wave 1 | **Blocks**: T7 | **Blocked By**: T1

  **References**:
  - `WhisperApp/WhisperApp/Services/HotkeyManager.swift:320-369` — State machine logic to validate uiohook can support
  - `WhisperApp/WhisperApp/Services/HotkeyManager.swift:41-42` — Threshold constants
  - uiohook-napi: https://www.npmjs.com/package/uiohook-napi

  **Acceptance Criteria**:
  - [ ] uiohook-napi installs without errors
  - [ ] F5 keyDown + keyUp detected as separate events
  - [ ] Hold duration accurate (±50ms)
  - [ ] Double-press detected
  - [ ] Auto-repeat filtered
  - [ ] Events fire when unfocused
  - [ ] Results in `HOTKEY_SPIKE_RESULTS.md`

  **QA Scenarios:**
  ```
  Scenario: uiohook captures F5 events
    Tool: interactive_bash (tmux)
    Steps: 1. Start spike. 2. Hold F5 for 1s, release. 3. Assert keyDown+keyUp logged with ~1000ms delta. 4. Double-press F5. 5. Assert 'double-press detected'. 6. Press Escape. 7. Assert Escape event logged.
    Expected: All events captured with correct timing
    Evidence: .sisyphus/evidence/task-3-hotkey-spike.txt
  ```

  **Commit**: YES — `feat(electron): validate uiohook-napi hotkey spike`

- [x] 4. Test Infrastructure Setup (Vitest + Playwright)

  **What to do**:
  - Install: `vitest`, `@vitest/coverage-v8`, `@playwright/test`
  - Create `vitest.config.ts` (TS support, path aliases, pattern: `tests/unit/**/*.test.ts`)
  - Create `playwright.config.ts` (Electron launch, screenshot on failure, pattern: `tests/e2e/**/*.test.ts`)
  - Create `tests/unit/example.test.ts` (import shared type, assert)
  - Create `tests/e2e/example.test.ts` (launch Electron, check window exists)
  - Add scripts: `test`, `test:e2e`, `test:coverage`

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []
  **Parallelization**: Wave 1 | **Blocks**: T27 | **Blocked By**: T1

  **Acceptance Criteria**:
  - [ ] `npm test` runs and passes
  - [ ] `npm run test:e2e` runs and passes

  **QA Scenarios:**
  ```
  Scenario: Test infrastructure works
    Tool: Bash
    Steps: 1. `npm test` → exit 0, 1+ test passed. 2. `npm run test:e2e` → exit 0, 1+ test passed.
    Expected: Both test runners execute successfully
    Evidence: .sisyphus/evidence/task-4-tests.txt
  ```

  **Commit**: YES — `test(electron): setup Vitest + Playwright infrastructure`

- [x] 5. Tailwind Design Tokens + Base Component Library

  **What to do**:
  - Configure Tailwind theme tokens: colors (idle green, recording red, error orange, cancelled grey), spacing, border-radius, typography
  - Create base components in `src/renderer/components/`: `Button.tsx` (with hover/active states), `StatusBadge.tsx` (circle indicator), `IconButton.tsx`
  - Style to match the Swift app aesthetic: semi-transparent dark backgrounds, rounded pill shapes for overlay, clean form fields for settings
  - Create `src/renderer/styles/globals.css` with Tailwind directives and any global styles

  **Must NOT do**: No application views. No business logic. Base UI primitives only.

  **Recommended Agent Profile**: **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Parallelization**: Wave 1 | **Blocks**: T16-T20 | **Blocked By**: T1

  **References**:
  - `WhisperApp/WhisperApp/Views/MenuBarView.swift:200-241` — MenuBarButton hover effect pattern
  - `WhisperApp/WhisperApp/Views/RecordingOverlayView.swift:26-171` — Overlay visual design (colors, opacity, border)

  **Acceptance Criteria**:
  - [ ] Tailwind config has custom color tokens
  - [ ] Button, StatusBadge, IconButton components render correctly
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios:**
  ```
  Scenario: Components render without errors
    Tool: Bash
    Steps: 1. `npm run build` → exit 0. 2. `npx tsc --noEmit` → exit 0.
    Expected: Build succeeds with new components
    Evidence: .sisyphus/evidence/task-5-components.txt
  ```

  **Commit**: YES — `feat(electron): add Tailwind design tokens and base components`

### Wave 2 — Core Services (8 tasks, all parallel)

- [x] 6. Audio Recording Service (Web Audio API + WAV Encoding)

  **What to do**:
  - Create `src/main/services/audio-recorder.ts` — manages recording lifecycle from main process
  - In renderer: use `navigator.mediaDevices.getUserMedia({ audio: true })` + `AudioContext` + `AudioWorkletNode` to capture raw PCM data
  - Implement **resampling** from device sample rate (typically 44100/48000 Hz) to 16000 Hz using linear interpolation or polyphase filter
  - Implement WAV encoding: manual RIFF/WAV header construction (44 bytes) + 16-bit PCM little-endian data. Format: 16kHz, mono, 16-bit, PCM
  - IPC flow: main process tells renderer to start/stop via IPC; renderer sends encoded WAV buffer back to main process
  - Main process saves WAV file to temp directory, returns file path
  - Create AudioWorklet processor file for real-time PCM capture (avoid deprecated ScriptProcessorNode)
  - Unit tests: WAV header encoding (verify RIFF magic, sample rate, bit depth, channel count), resampling (verify output length ratio)

  **Must NOT do**: No FFmpeg bundling. No system audio capture. Microphone only.

  **Recommended Agent Profile**: **Category**: `deep` | **Skills**: []
  **Parallelization**: Wave 2 (parallel with T7-T13) | **Blocks**: T21 | **Blocked By**: T1, T2

  **References**:
  - `WhisperApp/WhisperApp/Services/AudioRecorder.swift:18-25` — Audio format spec: `kAudioFormatLinearPCM`, 16000.0 Hz, 1 channel, 16-bit, little-endian
  - Web Audio API AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode

  **Acceptance Criteria**:
  - [ ] Records audio from microphone as 16kHz mono 16-bit PCM WAV
  - [ ] WAV file validates: `file output.wav` shows RIFF/WAV, 16000 Hz, mono, 16-bit
  - [ ] Unit tests for WAV header encoding pass
  - [ ] Unit tests for resampling pass (44100→16000 produces correct output length)

  **QA Scenarios:**
  ```
  Scenario: WAV encoding produces valid file
    Tool: Bash
    Steps: 1. Run unit test: `npm test -- audio-recorder`. 2. Assert WAV header test passes (RIFF magic bytes, sampleRate=16000, channels=1, bitsPerSample=16). 3. Assert resampling test passes.
    Expected: All audio tests pass
    Evidence: .sisyphus/evidence/task-6-audio.txt

  Scenario: WAV file is Whisper-compatible
    Tool: Bash
    Steps: 1. Record 2-second test audio. 2. Run `file test.wav`. 3. Assert output contains 'RIFF' and 'PCM' and '16000 Hz' and 'mono'.
    Expected: WAV file format matches Whisper API requirements
    Evidence: .sisyphus/evidence/task-6-wav-format.txt
  ```

  **Commit**: YES — `feat(electron): add audio recording service with WAV encoding`

- [x] 7. Hotkey Manager (uiohook-napi State Machine)

  **What to do**:
  - Create `src/main/services/hotkey-manager.ts` implementing the full state machine from the Swift app:
    - Track `keyIsDown`, `isToggleRecording`, `lastKeyDownTime`, `holdTimer`
    - **handleKeyDown**: if toggle active → toggleOff. Else if double-press (within 400ms) → toggleOn. Else start hold timer (300ms) → holdStart on fire.
    - **handleKeyUp**: if hold timer pending → cancel it (was quick press). Else if not toggle → holdEnd.
    - Filter auto-repeat events (uiohook-napi provides this)
    - Escape detection: if recording/transcribing/processing → fire `cancel` action
    - **Configurable hotkey**: read keycode from settings, restart listener on change
  - Use uiohook-napi keycode (from spike results in Task 3) for F5 default
  - Emit `HotkeyAction` events via callback
  - Unit tests: state machine logic in isolation (mock timers, assert action sequences)
    - hold >300ms → holdStart+holdEnd
    - quick tap → no action
    - double-press → toggleOn, then single press → toggleOff
    - escape during recording → cancel
    - auto-repeat → ignored

  **Must NOT do**: No UI. No recording logic. Pure hotkey state machine.

  **Recommended Agent Profile**: **Category**: `deep` | **Skills**: []
  **Parallelization**: Wave 2 | **Blocks**: T14, T20, T21 | **Blocked By**: T3 (spike results)

  **References**:
  - `WhisperApp/WhisperApp/Services/HotkeyManager.swift:320-369` — handleKeyDown/handleKeyUp state machine (port this logic exactly)
  - `WhisperApp/WhisperApp/Services/HotkeyManager.swift:240-283` — Normal key event handling with auto-repeat filtering
  - `WhisperApp/WhisperApp/Services/HotkeyManager.swift:287-316` — Media key event handling (NX_SYSDEFINED) — not needed in Electron, uiohook handles this
  - `electron-app/spikes/HOTKEY_SPIKE_RESULTS.md` — F5 keycode and behavior from spike

  **Acceptance Criteria**:
  - [ ] State machine unit tests pass (all 9 scenarios from Metis AC1)
  - [ ] Hotkey capture works when app is not focused
  - [ ] Auto-repeat events filtered
  - [ ] Escape fires cancel when recording/transcribing/processing

  **QA Scenarios:**
  ```
  Scenario: State machine unit tests
    Tool: Bash
    Steps: 1. `npm test -- hotkey-manager`. 2. Assert all state machine tests pass: hold, quick-tap, double-press, toggleOff, escape-cancel, auto-repeat-filter, escape-idle-passthrough.
    Expected: 9+ tests pass
    Evidence: .sisyphus/evidence/task-7-hotkey-tests.txt
  ```

  **Commit**: YES — `feat(electron): add hotkey manager with state machine`

- [x] 8. Transcription Service (Whisper API with Retry)

  **What to do**:
  - Create `src/main/services/transcription-service.ts`
  - Implement multipart/form-data POST to `{baseURL}/v1/audio/transcriptions`
  - Fields: `model` (from settings), `response_format: 'json'`, `language` (if non-empty), `file` (WAV audio)
  - Use Node.js native `https`/`http` module with `form-data` npm package
  - Implement retry with backoff: 3 attempts, delays [500ms, 1500ms, 3000ms], no retry on 4xx except 408/429 (G16)
  - Timeout: 60s (G16)
  - Parse response: `{ text: string }` JSON
  - Unit tests: retry logic (mock HTTP), error classification (4xx vs 5xx vs network)

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 2 | **Blocks**: T14, T21 | **Blocked By**: T1, T2

  **References**:
  - `WhisperApp/WhisperApp/Services/TranscriptionService.swift:33-125` — Entire transcription flow to port (multipart construction, retry logic, error handling)
  - `src/shared/constants.ts` — MAX_RETRIES, RETRY_DELAYS_MS, WHISPER_TIMEOUT_MS

  **Acceptance Criteria**:
  - [ ] Retry logic unit tests pass (retry on 5xx/408/429, no retry on 400-499)
  - [ ] Multipart form-data correctly constructed with model, file, language, response_format
  - [ ] 60s timeout configured

  **QA Scenarios:**
  ```
  Scenario: Retry logic
    Tool: Bash
    Steps: 1. `npm test -- transcription-service`. 2. Assert: retries on 500, retries on 429, no retry on 401, no retry on 400, returns text on 200.
    Expected: All retry tests pass
    Evidence: .sisyphus/evidence/task-8-transcription.txt
  ```

  **Commit**: YES — `feat(electron): add Whisper transcription service with retry`

- [x] 9. LLM Post-Processing Service

  **What to do**:
  - Create `src/main/services/llm-service.ts`
  - POST to `{baseURL}/v1/chat/completions` with JSON body
  - Body: `{ model: settings.llmModelName, messages: [{role:'system', content: systemPrompt}, {role:'user', content: '<transcription>{text}</transcription>'}], reasoning_effort: 'low' }` (G14)
  - Same retry logic as transcription service — extract shared `retryWithBackoff()` utility into `src/main/services/retry.ts`
  - Timeout: 30s
  - Parse response: `choices[0].message.content`, trim whitespace
  - Unit tests: retry logic, request body construction (verify `reasoning_effort: 'low'` present, verify `<transcription>` tags)

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 2 | **Blocks**: T14, T21 | **Blocked By**: T1, T2

  **References**:
  - `WhisperApp/WhisperApp/Services/LLMService.swift:39-125` — Entire LLM flow to port (request construction, retry, parsing)
  - Note `reasoning_effort: 'low'` on line 61 — non-standard parameter, MUST be preserved (G14)
  - Note `<transcription>` tags on line 56 — security measure against prompt injection

  **Acceptance Criteria**:
  - [ ] Request body includes `reasoning_effort: 'low'` (G14)
  - [ ] Text wrapped in `<transcription>` tags
  - [ ] Shared retry utility used (not duplicated from T8)
  - [ ] 30s timeout

  **QA Scenarios:**
  ```
  Scenario: LLM request body construction
    Tool: Bash
    Steps: 1. `npm test -- llm-service`. 2. Assert: request body contains reasoning_effort:'low'. 3. Assert: user message wraps text in <transcription> tags. 4. Assert: system prompt used when non-empty.
    Expected: All LLM tests pass
    Evidence: .sisyphus/evidence/task-9-llm.txt
  ```

  **Commit**: YES — `feat(electron): add LLM post-processing service`

- [x] 10. Paste Service (Clipboard + Keyboard Simulation)

  **What to do**:
  - Create `src/main/services/paste-service.ts`
  - Write text to clipboard: `clipboard.writeText(text)` (Electron built-in)
  - Simulate paste keystroke using `@nut-tree/nut-js`:
    - macOS: Meta+V
    - Windows: Control+V
    - Linux (X11): Control+V
    - Linux (Wayland): Skip simulation, just clipboard write (detect via `process.env.WAYLAND_DISPLAY` or `XDG_SESSION_TYPE`)
  - Add 50ms delay between clipboard write and paste simulation
  - On Wayland: emit event to show notification "Text copied! Press Ctrl+V to paste"
  - Unit tests: platform detection logic, Wayland detection

  **Must NOT do**: No clipboard save/restore. Simple overwrite only.

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 2 | **Blocks**: T14, T21 | **Blocked By**: T1, T2

  **References**:
  - `WhisperApp/WhisperApp/Services/PasteService.swift:9-45` — Paste flow (our version is simpler: no save/restore)
  - `WhisperApp/WhisperApp/Services/PasteService.swift:47-59` — Cmd+V simulation pattern
  - @nut-tree/nut-js: https://nutjs.dev/

  **Acceptance Criteria**:
  - [ ] Platform detection returns correct modifier per OS (G12)
  - [ ] Wayland detection works (`XDG_SESSION_TYPE === 'wayland'` or `WAYLAND_DISPLAY` set)
  - [ ] Clipboard write works on all platforms

  **QA Scenarios:**
  ```
  Scenario: Platform detection
    Tool: Bash
    Steps: 1. `npm test -- paste-service`. 2. Assert: darwin → Meta+V, win32 → Control+V, linux → Control+V.
    Expected: Platform tests pass
    Evidence: .sisyphus/evidence/task-10-paste.txt
  ```

  **Commit**: YES — `feat(electron): add paste service with platform detection`

- [x] 11. Settings Persistence Service

  **What to do**:
  - Create `src/main/services/settings-service.ts`
  - Use `app.getPath('userData')` for storage directory (G13)
  - Read/write `settings.json` in userData directory
  - Load on init: read file, merge with defaults (handle missing fields gracefully)
  - Save on change: atomic write (write to temp, rename)
  - Default values from `src/shared/constants.ts`
  - Unit tests: load from empty (defaults), load with partial data (merge), save and reload roundtrip

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []
  **Parallelization**: Wave 2 | **Blocks**: T14, T18 | **Blocked By**: T1, T2

  **References**:
  - `WhisperApp/WhisperApp/Models/AppSettings.swift:145-202` — Settings persistence pattern (load/save JSON, merge with defaults)

  **Acceptance Criteria**:
  - [ ] Uses `app.getPath('userData')` (G13)
  - [ ] Missing fields filled with defaults on load
  - [ ] Save + reload roundtrip preserves all fields

  **QA Scenarios:**
  ```
  Scenario: Settings persistence roundtrip
    Tool: Bash
    Steps: 1. `npm test -- settings-service`. 2. Assert: load-empty returns defaults. 3. Assert: save+load roundtrip. 4. Assert: partial data merged with defaults.
    Expected: All settings tests pass
    Evidence: .sisyphus/evidence/task-11-settings.txt
  ```

  **Commit**: YES — `feat(electron): add settings persistence service`

- [x] 12. History Persistence Service

  **What to do**:
  - Create `src/main/services/history-service.ts`
  - Read/write `history.json` in userData directory
  - Max 100 entries (trim oldest, delete associated audio files on trim) (G16)
  - Backward-compatible loading: `status` defaults to `'successful'` if missing, `rawText`/`audioFilePath` optional (G19)
  - Audio files stored in `recordings/` subdirectory under userData
  - Crash recovery: on load, mark entries stuck in `'transcribing'` as `'failed'` with errorMessage `'Interrupted by app restart'`
  - CRUD: add entry, update entry, delete entry (+ audio file), clear all (+ all audio files)
  - Unit tests: max entries trim, backward-compatible loading, crash recovery, CRUD

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []
  **Parallelization**: Wave 2 | **Blocks**: T14, T19 | **Blocked By**: T1, T2

  **References**:
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:401-439` — History persistence (loadHistory, saveHistory, fixInterruptedEntries)
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:339-365` — Delete entry + audio file cleanup
  - `WhisperApp/WhisperApp/Models/TranscriptionEntry.swift:49-64` — Backward-compatible decoding

  **Acceptance Criteria**:
  - [ ] Max 100 entries enforced, audio files cleaned on trim
  - [ ] `.transcribing` entries marked `.failed` on load (crash recovery)
  - [ ] Missing `status` field defaults to `'successful'` (G19)

  **QA Scenarios:**
  ```
  Scenario: History persistence
    Tool: Bash
    Steps: 1. `npm test -- history-service`. 2. Assert: max-100 trim works. 3. Assert: crash recovery marks transcribing as failed. 4. Assert: backward-compat loading.
    Expected: All history tests pass
    Evidence: .sisyphus/evidence/task-12-history.txt
  ```

  **Commit**: YES — `feat(electron): add history persistence service`

- [x] 13. Audio Playback Service

  **What to do**:
  - Create `src/main/services/audio-player-service.ts` (or in renderer via IPC)
  - Play WAV files from history (using HTML5 `<audio>` element in renderer or `AudioContext`)
  - Stop current playback, toggle play/stop for specific entry
  - Track `isPlaying` and `playingEntryId` state
  - IPC: main sends audio file path to renderer, renderer handles playback
  - Unit tests: state transitions (play/stop/toggle)

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []
  **Parallelization**: Wave 2 | **Blocks**: T19 | **Blocked By**: T1, T2

  **References**:
  - `WhisperApp/WhisperApp/Services/AudioPlayerService.swift:1-58` — Full playback service to port

  **Acceptance Criteria**:
  - [ ] Play/stop/toggle state management works
  - [ ] Only one entry plays at a time

  **QA Scenarios:**
  ```
  Scenario: Playback state management
    Tool: Bash
    Steps: 1. `npm test -- audio-player`. 2. Assert: play sets isPlaying=true. 3. Assert: stop sets isPlaying=false. 4. Assert: toggle switches correctly.
    Expected: All playback tests pass
    Evidence: .sisyphus/evidence/task-13-playback.txt
  ```

  **Commit**: YES — `feat(electron): add audio playback service`

### Wave 3 — UI + Integration (7 tasks, all parallel)

- [x] 14. App State Manager + IPC Bridge

  **What to do**:
  - Create `src/main/app-state.ts` — central state manager in main process
  - Mirrors the Swift `AppState` class: holds `recordingState`, manages recording lifecycle (start → transcribe → LLM → paste)
  - Orchestrates services: AudioRecorder, HotkeyManager, TranscriptionService, LLMService, PasteService, SettingsService, HistoryService
  - Create `src/main/ipc-handlers.ts` — registers all IPC handlers (ipcMain.handle/on) for renderer communication
  - Create `src/main/preload.ts` — exposes IPC methods to renderer via `contextBridge.exposeInMainWorld('api', { ... })`
  - IPC channels from `src/shared/ipc-channels.ts`
  - State changes pushed to renderer via `webContents.send(IPC.STATE_UPDATE, state)`
  - Wiring: HotkeyManager.onAction → AppState.handleHotkeyAction → start/stop/cancel recording

  **Recommended Agent Profile**: **Category**: `deep` | **Skills**: []
  **Parallelization**: Wave 3 | **Blocks**: T15-T17, T21 | **Blocked By**: T7, T8, T9, T10, T11, T12

  **References**:
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:16-440` — ENTIRE AppState class. This is the primary reference. Port all logic.
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:103-112` — handleHotkeyAction switch
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:130-215` — stopRecordingAndTranscribe (main recording flow)
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:217-254` — cancelRecording (G17: save audio if ≥0.5s)
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:258-326` — retryTranscription

  **Acceptance Criteria**:
  - [ ] IPC handlers registered for all channels in ipc-channels.ts
  - [ ] State changes propagated to renderer via STATE_UPDATE
  - [ ] Hotkey actions wired to state machine

  **QA Scenarios:**
  ```
  Scenario: IPC bridge works
    Tool: Bash
    Steps: 1. `npm test -- ipc`. 2. Assert: all IPC channels have registered handlers.
    Expected: IPC handlers registered
    Evidence: .sisyphus/evidence/task-14-ipc.txt
  ```

  **Commit**: YES — `feat(electron): add app state manager with IPC bridge`

- [x] 15. System Tray + Tray Menu

  **What to do**:
  - Create `src/main/tray.ts` — creates Electron `Tray` with context menu
  - Tray icon changes based on state: idle (mic outline), recording (mic filled red), transcribing/processing (ellipsis). Need 3 icon PNGs in `assets/icons/` (16x16 and 32x32 for each, template images for macOS)
  - Context menu items: status text, Start/Stop Recording, separator, History, Settings, separator, Quit
  - Tray click on macOS: show popup menu. Tray click on Windows/Linux: show popup menu.
  - Alternative: instead of native context menu, open a small frameless BrowserWindow (like the Swift app's MenuBarExtra). Decision: use native context menu for simplicity in v1.
  - Hide dock icon on macOS: `app.dock.hide()` (already in main.ts from T1)

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 3 | **Blocks**: T21 | **Blocked By**: T14

  **References**:
  - `WhisperApp/WhisperApp/WhisperApp.swift:22-30` — MenuBarExtra setup (tray equivalent)
  - `WhisperApp/WhisperApp/WhisperApp.swift:32-47` — MenuBarLabel (icon changes by state)
  - `WhisperApp/WhisperApp/Views/MenuBarView.swift:5-86` — Tray dropdown content

  **Acceptance Criteria**:
  - [ ] Tray icon appears on all platforms
  - [ ] Icon changes based on recording state
  - [ ] Context menu has all items (Start/Stop, History, Settings, Quit)

  **QA Scenarios:**
  ```
  Scenario: Tray icon appears
    Tool: Bash
    Steps: 1. Build and launch app. 2. Assert process is running. 3. Assert tray icon visible (check via Playwright Electron).
    Expected: Tray icon visible
    Evidence: .sisyphus/evidence/task-15-tray.png
  ```

  **Commit**: YES — `feat(electron): add system tray with context menu`

- [x] 16. Overlay Window (Transparent BrowserWindow)

  **What to do**:
  - Create overlay `BrowserWindow` in main process: `transparent: true, frame: false, alwaysOnTop: true, focusable: false, resizable: false, skipTaskbar: true`
  - Position: bottom-center of primary screen (above taskbar/dock)
  - `setIgnoreMouseEvents(true)` for click-through (G8 equivalent)
  - Create `src/renderer/views/OverlayView.tsx` — React component rendering overlay states:
    - recording: red pulsing dot + "Recording" text
    - transcribing: spinner + "Transcribing..." text
    - processing: spinner + "Processing..." text
    - done: green checkmark + transcription text (max 6 lines)
    - error: orange warning + error message (1 line, truncated)
    - cancelled: grey X + "Cancelled" text
  - Styling: semi-transparent dark background (`rgba(0,0,0,0.6)`), rounded corners, thin colored border
  - Show/hide via IPC from main process (OVERLAY_UPDATE channel)
  - Auto-dismiss timers: done=3s, error=5s, cancelled=1.5s (from constants)
  - Fade-out animation on dismiss

  **Recommended Agent Profile**: **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Parallelization**: Wave 3 | **Blocks**: T21 | **Blocked By**: T5, T14

  **References**:
  - `WhisperApp/WhisperApp/Views/RecordingOverlayView.swift:26-274` — ENTIRE overlay view + window manager. Port visual design exactly.
  - `WhisperApp/WhisperApp/Views/RecordingOverlayView.swift:175-274` — OverlayWindowManager (window creation, positioning, dismiss timers)

  **Acceptance Criteria**:
  - [ ] Overlay appears above all windows, click-through
  - [ ] All 6 states render correctly with correct colors/icons
  - [ ] Auto-dismiss timers: done=3s, error=5s, cancelled=1.5s
  - [ ] Positioned bottom-center of screen

  **QA Scenarios:**
  ```
  Scenario: Overlay renders all states
    Tool: Playwright
    Steps: 1. Send each overlay state via IPC. 2. Screenshot each. 3. Assert correct text/color per state. 4. Assert done state dismisses after ~3s.
    Expected: All states render, auto-dismiss works
    Evidence: .sisyphus/evidence/task-16-overlay-*.png
  ```

  **Commit**: YES — `feat(electron): add floating overlay window`

- [x] 17. Menu Bar Dropdown View (React)

  **What to do**:
  - If using native context menu (T15): skip this task or make it a richer BrowserWindow popup
  - Decision for v1: Use **native Electron context menu** from T15 for the tray dropdown. This task creates a richer React-based **status popup** that can be triggered from tray click as an alternative to context menu.
  - Create `src/renderer/views/TrayMenuView.tsx` — React view with:
    - Status section (Ready/Recording/Transcribing/Processing/Error indicators)
    - Start/Stop Recording button with hotkey label
    - Last transcription preview (text, copy button, retry button for failed)
    - History/Settings/Quit buttons with hover effects
  - Open as small frameless BrowserWindow near tray position on tray click
  - Style to match Swift app's MenuBarView aesthetic

  **Recommended Agent Profile**: **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Parallelization**: Wave 3 | **Blocks**: T21 | **Blocked By**: T5, T14

  **References**:
  - `WhisperApp/WhisperApp/Views/MenuBarView.swift:5-198` — ENTIRE MenuBarView. Port layout and behavior.
  - `WhisperApp/WhisperApp/Views/MenuBarView.swift:200-241` — MenuBarButton with hover effect

  **Acceptance Criteria**:
  - [ ] Shows current status with correct indicator
  - [ ] Start/Stop Recording button works
  - [ ] Last transcription preview with copy/retry
  - [ ] History/Settings/Quit buttons work

  **QA Scenarios:**
  ```
  Scenario: Tray menu shows status
    Tool: Playwright
    Steps: 1. Launch app. 2. Trigger tray menu. 3. Assert 'Ready' status shown. 4. Assert Start Recording button visible.
    Expected: Menu renders with correct content
    Evidence: .sisyphus/evidence/task-17-tray-menu.png
  ```

  **Commit**: YES — `feat(electron): add tray menu dropdown view`

- [x] 18. Settings Window (React Form)

  **What to do**:
  - Create `src/renderer/views/SettingsView.tsx` — React form with sections:
    - **API Configuration**: Base URL (text field), API Key (password field), Model (text field), Language (text field with "auto-detect" placeholder)
    - **LLM Post-Processing**: Enable toggle, Model field, System Prompt (textarea with "Reset to Default" button when changed)
    - **Hotkey**: Current key display + "Change" button (triggers capture mode via T20), "Reset to F5" button when changed
    - **Permissions**: Microphone status (green check / red X), Accessibility note for macOS
    - **Debug**: Last event debug text
  - Settings loaded via IPC (GET_SETTINGS), saved via IPC (SAVE_SETTINGS) on each field change
  - Opens as separate `BrowserWindow` (400x680, titled, closable, not resizable)
  - macOS: show in Dock when settings window is open, hide when closed (like Swift app)

  **Recommended Agent Profile**: **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Parallelization**: Wave 3 | **Blocks**: T20, T21 | **Blocked By**: T5, T11, T14

  **References**:
  - `WhisperApp/WhisperApp/Views/SettingsView.swift:5-178` — ENTIRE SettingsView. Port all sections.
  - `WhisperApp/WhisperApp/Views/SettingsView.swift:19-39` — API Configuration section
  - `WhisperApp/WhisperApp/Views/SettingsView.swift:41-77` — LLM Post-Processing section
  - `WhisperApp/WhisperApp/Views/SettingsView.swift:79-124` — Hotkey section
  - `WhisperApp/WhisperApp/Views/SettingsView.swift:126-165` — Permissions section

  **Acceptance Criteria**:
  - [ ] All setting fields present and editable
  - [ ] Settings persist on change (save via IPC)
  - [ ] LLM fields disabled when toggle is off
  - [ ] "Reset to Default" for system prompt works

  **QA Scenarios:**
  ```
  Scenario: Settings form works
    Tool: Playwright
    Steps: 1. Open settings window. 2. Change API Base URL. 3. Close and reopen. 4. Assert URL persisted.
    Expected: Settings persist across window close/reopen
    Evidence: .sisyphus/evidence/task-18-settings.png
  ```

  **Commit**: YES — `feat(electron): add settings window`

- [x] 19. History Window (React List)

  **What to do**:
  - Create `src/renderer/views/HistoryView.tsx` — scrollable list of TranscriptionEntry items:
    - Successful: text (4 lines max), raw transcription disclosure (if rawText present), orange warning (if errorMessage on successful), copy/delete buttons
    - Failed: red "Transcription failed" + error message, retry/delete buttons (retry if audio available)
    - Cancelled: grey "Recording cancelled", retry/delete buttons (if audio available)
    - Transcribing: spinner + "Transcribing..."
    - Each row: status badge, duration, relative timestamp ("X ago"), action buttons
  - Play button: visible when audio file exists, toggles playback via IPC (PLAY_AUDIO/STOP_AUDIO)
  - "Clear All" button in header
  - Empty state: icon + "No transcriptions yet" + hotkey hint
  - Opens as separate `BrowserWindow` (420x500)

  **Recommended Agent Profile**: **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Parallelization**: Wave 3 | **Blocks**: T21 | **Blocked By**: T5, T12, T13, T14

  **References**:
  - `WhisperApp/WhisperApp/Views/HistoryView.swift:5-250` — ENTIRE HistoryView + HistoryRow. Port all status rendering.
  - `WhisperApp/WhisperApp/Views/HistoryView.swift:55-250` — HistoryRow with all status variants + action buttons

  **Acceptance Criteria**:
  - [ ] All 4 status types render correctly
  - [ ] Copy button works, shows "Copied" feedback
  - [ ] Delete removes entry + audio file
  - [ ] Play/stop audio works
  - [ ] Empty state shown when no entries

  **QA Scenarios:**
  ```
  Scenario: History shows entries
    Tool: Playwright
    Steps: 1. Create test history entries via IPC. 2. Open history window. 3. Assert entries visible. 4. Click copy on successful entry. 5. Assert 'Copied' feedback.
    Expected: History renders and interactions work
    Evidence: .sisyphus/evidence/task-19-history.png
  ```

  **Commit**: YES — `feat(electron): add history window`

- [x] 20. Hotkey Capture UI in Settings

  **What to do**:
  - In Settings hotkey section: "Change" button enters capture mode ("Press any key...")
  - In capture mode: uiohook-napi listens for next keyDown event, captures keycode, maps to key name, saves to settings, restarts hotkey manager
  - IPC flow: renderer sends START_HOTKEY_CAPTURE → main process enables capture mode in HotkeyManager → on capture, sends HOTKEY_CAPTURED back to renderer with {keyCode, keyName}
  - Key name mapping: port `HotkeyConfig.knownKeys` from Swift app to TypeScript lookup table
  - "Reset to F5" button when current hotkey differs from default

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 3 | **Blocks**: T21 | **Blocked By**: T7, T18

  **References**:
  - `WhisperApp/WhisperApp/Views/SettingsView.swift:183-287` — HotkeyCaptureModifier + HotkeyCaptureView + HotkeyCaptureNSView (port capture logic)
  - `WhisperApp/WhisperApp/Models/AppSettings.swift:18-90` — knownKeys mapping (port to TypeScript)

  **Acceptance Criteria**:
  - [ ] "Change" button enters capture mode
  - [ ] Next keypress captured and saved
  - [ ] Key name displayed correctly
  - [ ] Hotkey manager restarts with new key

  **QA Scenarios:**
  ```
  Scenario: Hotkey capture works
    Tool: Playwright + interactive_bash
    Steps: 1. Open settings. 2. Click 'Change'. 3. Assert 'Press any key...' shown. 4. Press a key. 5. Assert new key displayed.
    Expected: Capture mode works
    Evidence: .sisyphus/evidence/task-20-hotkey-capture.png
  ```

  **Commit**: YES — `feat(electron): add hotkey capture UI`

### Wave 4 — Integration + Polish (4 tasks)

- [x] 21. Recording Lifecycle Integration (record → transcribe → LLM → paste)

  **What to do**:
  - Wire the full end-to-end flow in `app-state.ts`:
    1. Hotkey holdStart/toggleOn → check mic permission → start AudioRecorder → set state=recording → show overlay(recording)
    2. Hotkey holdEnd/toggleOff → stop AudioRecorder → get WAV file + duration → persist audio to recordings/ → create history entry (status=transcribing) → set state=transcribing → show overlay(transcribing)
    3. Call TranscriptionService.transcribe(wavFile) → get rawText
    4. If LLM enabled: set state=processing → show overlay(processing) → call LLMService.process(rawText) → on success: text=processedText. On LLM failure: text=rawText, errorMessage='LLM failed: ...' (G18)
    5. Update history entry (status=successful, text, rawText if LLM used) → set state=idle → show overlay(done(text)) → PasteService.paste(text)
    6. On transcription failure: update history entry (status=failed, errorMessage) → set state=error → show overlay(error)
  - Handle cancellation check: `Task.isCancelled` equivalent — use AbortController for fetch requests, check abort flag between steps
  - Microphone permission request flow: `navigator.mediaDevices.getUserMedia()` in renderer, report status to main via IPC

  **Recommended Agent Profile**: **Category**: `deep` | **Skills**: []
  **Parallelization**: Wave 4 | **Blocks**: T22, T23, T24 | **Blocked By**: T6, T14, T15, T16, T17

  **References**:
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:130-215` — stopRecordingAndTranscribe — THE CORE FLOW. Port step by step.
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:116-128` — startRecording with mic permission check
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:157-201` — LLM post-processing branch with fallback (G18)

  **Acceptance Criteria**:
  - [ ] Full flow: hotkey → record → transcribe → paste works end-to-end
  - [ ] LLM failure falls back to raw text with errorMessage (G18)
  - [ ] History entry created at each stage with correct status
  - [ ] Overlay shows correct state at each stage

  **QA Scenarios:**
  ```
  Scenario: Full recording flow (without LLM)
    Tool: Playwright + interactive_bash
    Steps: 1. Configure API key in settings. 2. Disable LLM. 3. Hold F5 for 2s, release. 4. Assert overlay shows recording→transcribing→done. 5. Assert history entry created with status=successful.
    Expected: Full flow completes, text appears in history
    Evidence: .sisyphus/evidence/task-21-full-flow.txt

  Scenario: LLM failure fallback
    Tool: Bash (unit test)
    Steps: 1. Mock LLM service to throw error. 2. Run recording flow. 3. Assert entry.status === 'successful'. 4. Assert entry.text === rawText. 5. Assert entry.errorMessage contains 'LLM'.
    Expected: Fallback to raw text on LLM failure
    Evidence: .sisyphus/evidence/task-21-llm-fallback.txt
  ```

  **Commit**: YES — `feat(electron): integrate full recording lifecycle`

- [x] 22. Cancel/Retry/Error Handling Integration

  **What to do**:
  - **Cancel during recording** (G17): if duration ≥0.5s → save audio + create entry(status=cancelled). If <0.5s → discard silently. Set state=idle, show overlay(cancelled).
  - **Cancel during transcription/processing**: abort in-flight HTTP request (AbortController.abort()), cancel transcription task, update entry(status=cancelled), set state=idle, show overlay(cancelled)
  - **Retry from failed/cancelled**: load audio file, create new transcription attempt, same flow as T21 but from existing audio file
  - **Escape key**: HotkeyManager fires `cancel` action → AppState.cancelRecording()
  - Error display: set state to error(message), overlay shows error, tray menu shows error status
  - Unit tests: cancel-saves-audio-if-long, cancel-discards-if-short, retry-from-failed, retry-from-cancelled

  **Recommended Agent Profile**: **Category**: `deep` | **Skills**: []
  **Parallelization**: Wave 4 | **Blocks**: T23, T24 | **Blocked By**: T21

  **References**:
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:217-254` — cancelRecording (G17: duration threshold logic)
  - `WhisperApp/WhisperApp/ViewModels/AppState.swift:258-326` — retryTranscription

  **Acceptance Criteria**:
  - [ ] Cancel during recording with ≥0.5s saves audio + creates cancelled entry (G17)
  - [ ] Cancel during recording with <0.5s discards silently (G17)
  - [ ] Cancel during transcription aborts HTTP request
  - [ ] Retry from failed entry works
  - [ ] Retry from cancelled entry works

  **QA Scenarios:**
  ```
  Scenario: Cancel saves audio if long enough
    Tool: Bash (unit test)
    Steps: 1. Start recording. 2. After 1s, trigger cancel. 3. Assert entry created with status=cancelled. 4. Assert audio file exists in recordings/.
    Expected: Audio preserved for retry
    Evidence: .sisyphus/evidence/task-22-cancel.txt

  Scenario: Cancel discards if too short
    Tool: Bash (unit test)
    Steps: 1. Start recording. 2. After 0.2s, trigger cancel. 3. Assert NO entry created. 4. Assert NO audio file.
    Expected: Short recording silently discarded
    Evidence: .sisyphus/evidence/task-22-short-cancel.txt
  ```

  **Commit**: YES — `feat(electron): add cancel, retry, and error handling`

- [x] 23. macOS-Specific Polish

  **What to do**:
  - **Dock visibility**: show app in Dock (Cmd+Tab) ONLY when Settings or History windows are open. Track open window count. `app.dock.show()` when count >0, `app.dock.hide()` when count returns to 0 (with 100ms delay for close animation).
  - **Universal binary**: configure electron-builder for macOS target `['dmg']` with arch `['x64', 'arm64']` or `universal`
  - **Cmd+V for paste**: verify PasteService uses Meta+V on macOS (already handled in T10)
  - **Tray icon**: use template images (16x16 PNG, @2x for Retina) with `nativeImage.createFromPath()` and `setTemplateImage(true)` for macOS menu bar
  - **App name in menu bar**: set `app.name = 'WhisperApp'`

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 4 (parallel with T24) | **Blocks**: T25 | **Blocked By**: T22

  **References**:
  - `WhisperApp/WhisperApp/WhisperApp.swift:51-135` — WindowManager with dock visibility toggle logic
  - `WhisperApp/WhisperApp/WhisperApp.swift:115-134` — windowDidOpen/windowWillClose with activation policy

  **Acceptance Criteria**:
  - [ ] Dock icon hidden when no windows open, shown when windows open (macOS only)
  - [ ] electron-builder.yml configured for macOS universal binary
  - [ ] Tray icon uses template image on macOS

  **QA Scenarios:**
  ```
  Scenario: Dock visibility on macOS
    Tool: Playwright
    Steps: 1. Launch app. Assert dock icon hidden. 2. Open Settings. Assert dock icon visible. 3. Close Settings. Assert dock icon hidden (after 100ms).
    Expected: Dock shows/hides correctly
    Evidence: .sisyphus/evidence/task-23-macos-dock.txt
  ```

  **Commit**: YES — `feat(electron): add macOS-specific polish`

- [x] 24. Linux-Specific Polish

  **What to do**:
  - **Wayland auto-paste fallback**: detect Wayland session (`XDG_SESSION_TYPE === 'wayland'` or `WAYLAND_DISPLAY` present). On Wayland: clipboard write only, show overlay/notification "Text copied! Press Ctrl+V to paste." instead of auto-paste.
  - **System tray on GNOME**: GNOME hides system tray by default. Detect GNOME + no AppIndicator extension → log warning, consider showing persistent small window as fallback.
  - **AppImage permissions**: ensure audio recording works in AppImage (sandboxing concerns)
  - **PipeWire audio**: test that Web Audio API works on PipeWire (modern Ubuntu/Fedora). Document any issues.
  - **electron-builder Linux config**: targets `['AppImage', 'deb', 'rpm']`, category `'Utility'`, deb depends `['libappindicator1']`

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 4 (parallel with T23) | **Blocks**: T25 | **Blocked By**: T22

  **References**:
  - PasteService (T10) — Wayland detection logic already implemented

  **Acceptance Criteria**:
  - [ ] Wayland detected correctly
  - [ ] Clipboard-only mode works on Wayland with notification
  - [ ] electron-builder.yml has Linux targets: AppImage, deb, rpm

  **QA Scenarios:**
  ```
  Scenario: Wayland fallback
    Tool: Bash (unit test)
    Steps: 1. Set XDG_SESSION_TYPE=wayland. 2. Run paste service. 3. Assert keyboard simulation skipped. 4. Assert clipboard write succeeded. 5. Assert notification emitted.
    Expected: Graceful fallback on Wayland
    Evidence: .sisyphus/evidence/task-24-wayland.txt
  ```

  **Commit**: YES — `feat(electron): add Linux-specific polish`

### Wave 5 — CI/CD + E2E + Docs (4 tasks)

- [x] 25. CI/CD Build Pipeline (GitHub Actions, 3 Platforms)

  **What to do**:
  - Create `.github/workflows/build-electron.yml`:
    - Trigger: push to main, PR to main
    - Three separate jobs (NOT matrix): `build-macos` (macos-14), `build-windows` (windows-latest), `build-linux` (ubuntu-22.04)
    - Each job: checkout, setup Node 20, `npm ci`, `npm run build`, `npm test`, `npm run make`
    - macOS job: build for both x64 and arm64
    - Linux job: install `libfuse-dev` for AppImage
    - Upload artifacts: macOS DMG, Windows NSIS exe, Linux AppImage+deb+rpm
    - 500 LOC per-file limit check (same as current `build.yml`)
  - No code signing (G2)
  - electron-builder.yml must have correct configs for each platform

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 5 | **Blocks**: T26 | **Blocked By**: T23, T24

  **References**:
  - `.github/workflows/build.yml` — Current CI pattern (LOC check, build step, artifact upload)
  - `.github/workflows/release.yml` — Current release pattern
  - Mattermost Desktop release.yaml pattern (separate jobs per OS)

  **Acceptance Criteria**:
  - [ ] CI builds succeed on all 3 platforms
  - [ ] Artifacts uploaded: macOS DMG, Windows exe, Linux AppImage+deb+rpm
  - [ ] 500 LOC check runs on electron-app/ source files

  **QA Scenarios:**
  ```
  Scenario: CI workflow syntax valid
    Tool: Bash
    Steps: 1. Read .github/workflows/build-electron.yml. 2. Assert valid YAML. 3. Assert 3 jobs defined. 4. Assert each job has correct `runs-on`. 5. Assert artifact upload step present.
    Expected: Workflow is valid and complete
    Evidence: .sisyphus/evidence/task-25-ci.txt
  ```

  **Commit**: YES — `build(electron): add CI build pipeline for all platforms`

- [x] 26. Release Pipeline (GitHub Releases, All Artifacts)

  **What to do**:
  - Create `.github/workflows/release-electron.yml`:
    - Trigger: push tag `v*`
    - Same 3 build jobs as T25, but with `--publish never` (build only, don't auto-publish)
    - After all builds: `publish` job downloads all artifacts, creates GitHub Release with `gh release create`
    - Release body: install instructions for each platform, download links
    - No code signing, no notarization (G2)
  - Update release notes template to include all 3 platforms

  **Recommended Agent Profile**: **Category**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave 5 (parallel with T25) | **Blocks**: T27, T28 | **Blocked By**: T25

  **References**:
  - `.github/workflows/release.yml` — Current release workflow to mirror/extend

  **Acceptance Criteria**:
  - [ ] Release workflow creates GitHub Release with all platform artifacts
  - [ ] Release notes include install instructions for macOS, Windows, Linux

  **QA Scenarios:**
  ```
  Scenario: Release workflow syntax valid
    Tool: Bash
    Steps: 1. Read release-electron.yml. 2. Assert valid YAML. 3. Assert tag trigger. 4. Assert publish job downloads artifacts. 5. Assert gh release create step.
    Expected: Workflow is valid
    Evidence: .sisyphus/evidence/task-26-release.txt
  ```

  **Commit**: YES — `build(electron): add release pipeline for all platforms`

- [x] 27. E2E Test Suite (Playwright)

  **What to do**:
  - Create comprehensive Playwright E2E tests in `tests/e2e/`:
    - `app-launch.test.ts`: app launches, tray icon exists, no crashes
    - `settings.test.ts`: open settings, change API URL, verify persistence
    - `history.test.ts`: open history, verify empty state, create mock entries, verify rendering
    - `overlay.test.ts`: trigger overlay states via IPC, verify rendering + auto-dismiss timing
    - `recording-flow.test.ts`: full flow with mocked API (mock Whisper endpoint returning test text, verify history entry created)
  - Use Playwright's Electron support: `_electron.launch()`
  - Mock external APIs (Whisper, LLM) to avoid real API calls in tests
  - Screenshot capture on failure

  **Recommended Agent Profile**: **Category**: `deep` | **Skills**: [`playwright`]
  **Parallelization**: Wave 5 (parallel with T25, T26) | **Blocks**: F1-F4 | **Blocked By**: T4, T21

  **References**:
  - `electron-app/playwright.config.ts` — Config from T4
  - All view references from T16-T19 for assertion targets

  **Acceptance Criteria**:
  - [ ] 5+ E2E test files created
  - [ ] All E2E tests pass: `npm run test:e2e`
  - [ ] No real API calls (all external APIs mocked)

  **QA Scenarios:**
  ```
  Scenario: E2E suite passes
    Tool: Bash
    Steps: 1. `cd electron-app && npm run build && npm run test:e2e`. 2. Assert exit 0. 3. Assert 5+ tests passed.
    Expected: All E2E tests pass
    Evidence: .sisyphus/evidence/task-27-e2e.txt
  ```

  **Commit**: YES — `test(electron): add E2E test suite`

- [x] 28. README Update with Cross-Platform Install Guide

  **What to do**:
  - Update `README.md` to document the Electron cross-platform app:
    - Keep existing Swift app section but mark it as "Legacy macOS-only version"
    - Add new "Cross-Platform Version" section with:
      - Download links for macOS (DMG), Windows (exe), Linux (AppImage, deb, rpm)
      - Install instructions per platform:
        - macOS: download DMG, drag to Applications, bypass Gatekeeper
        - Windows: download exe, run installer, SmartScreen bypass
        - Linux: AppImage (chmod +x, run), deb (sudo dpkg -i), rpm (sudo rpm -i)
      - Permissions: microphone access per OS
      - Configuration: API key, settings
    - Build from source: `cd electron-app && npm install && npm run dev`
    - Updated architecture diagram showing Electron structure

  **Recommended Agent Profile**: **Category**: `writing` | **Skills**: []
  **Parallelization**: Wave 5 (parallel with T25-T27) | **Blocks**: F1-F4 | **Blocked By**: T25, T26

  **References**:
  - `README.md` — Current README to update (keep backward-compatible, add new sections)

  **Acceptance Criteria**:
  - [ ] Install instructions for all 3 platforms
  - [ ] Build from source instructions for Electron app
  - [ ] Legacy Swift section preserved but marked

  **QA Scenarios:**
  ```
  Scenario: README is complete
    Tool: Bash
    Steps: 1. Read README.md. 2. Assert contains 'macOS' install section. 3. Assert contains 'Windows' section. 4. Assert contains 'Linux' section. 5. Assert contains 'npm run dev'.
    Expected: All platform instructions present
    Evidence: .sisyphus/evidence/task-28-readme.txt
  ```

  **Commit**: YES — `docs: update README with cross-platform install guide`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + `npx eslint .` + `npx vitest run`. Review all files in `electron-app/src/` for: `as any`/`@ts-ignore`, empty catches, console.log in prod code, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify all imports resolve.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state (delete userData). Launch app. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (full recording flow end-to-end). Test edge cases: empty state, invalid API key, rapid hotkey presses, cancel during transcription. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual implementation. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT Have" compliance. Detect guardrail violations (G1-G19). Flag unaccounted files.
  Output: `Tasks [N/N compliant] | Guardrails [N/N clean] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Wave | Commit | Message | Files |
|------|--------|---------|-------|
| 1 | 1 | `feat(electron): scaffold Electron + React + Tailwind project` | electron-app/* |
| 1 | 2 | `feat(electron): add shared types and constants` | electron-app/src/shared/* |
| 1 | 3 | `feat(electron): validate uiohook-napi hotkey spike` | electron-app/spikes/* |
| 1 | 4 | `test(electron): setup Vitest + Playwright infrastructure` | electron-app/tests/*, electron-app/vitest.config.ts, electron-app/playwright.config.ts |
| 1 | 5 | `feat(electron): add Tailwind design tokens and base components` | electron-app/src/renderer/components/* |
| 2 | 6 | `feat(electron): add audio recording service with WAV encoding` | electron-app/src/main/services/audio-recorder.ts |
| 2 | 7 | `feat(electron): add hotkey manager with state machine` | electron-app/src/main/services/hotkey-manager.ts |
| 2 | 8 | `feat(electron): add Whisper transcription service with retry` | electron-app/src/main/services/transcription-service.ts |
| 2 | 9 | `feat(electron): add LLM post-processing service` | electron-app/src/main/services/llm-service.ts |
| 2 | 10 | `feat(electron): add paste service with platform detection` | electron-app/src/main/services/paste-service.ts |
| 2 | 11-12 | `feat(electron): add settings and history persistence` | electron-app/src/main/services/settings-service.ts, history-service.ts |
| 2 | 13 | `feat(electron): add audio playback service` | electron-app/src/main/services/audio-player-service.ts |
| 3 | 14 | `feat(electron): add app state manager with IPC bridge` | electron-app/src/main/app-state.ts, electron-app/src/main/ipc-handlers.ts |
| 3 | 15-20 | `feat(electron): add tray, overlay, menu, settings, history, hotkey capture UI` | electron-app/src/main/tray.ts, electron-app/src/renderer/views/* |
| 4 | 21-22 | `feat(electron): integrate full recording lifecycle with cancel/retry` | electron-app/src/main/app-state.ts |
| 4 | 23-24 | `feat(electron): add macOS and Linux platform-specific polish` | various |
| 5 | 25-26 | `build(electron): add CI/CD and release pipelines for all platforms` | .github/workflows/* |
| 5 | 27 | `test(electron): add E2E test suite` | electron-app/tests/e2e/* |
| 5 | 28 | `docs: update README with cross-platform install guide` | README.md |

---

## Success Criteria

### Verification Commands
```bash
# Build succeeds
cd electron-app && npm run build          # Expected: no errors
cd electron-app && npm run make           # Expected: platform-specific artifact created

# Tests pass
cd electron-app && npx vitest run         # Expected: all tests pass
cd electron-app && npx playwright test    # Expected: all E2E tests pass

# TypeScript compiles
cd electron-app && npx tsc --noEmit       # Expected: no type errors

# Lint passes
cd electron-app && npx eslint src/        # Expected: no errors
```

### Final Checklist
- [ ] All "Must Have" features present and working
- [ ] All "Must NOT Have" guardrails (G1-G19) verified absent
- [ ] All Vitest unit tests pass
- [ ] All Playwright E2E tests pass
- [ ] App launches and shows tray icon on macOS, Windows, Linux
- [ ] Full recording flow works end-to-end
- [ ] CI/CD produces artifacts for all 3 platforms
- [ ] README has cross-platform install instructions
