import { test, expect } from '@playwright/test';

test.describe('recording flow via tray view state', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mocked: true }),
      });
    });

    await page.addInitScript(() => {
      const stateListeners: Array<(state: unknown) => void> = [];

      const api = {
        startRecording: async () => undefined,
        stopRecording: async () => undefined,
        cancelRecording: async () => undefined,
        sendRecordingData: () => undefined,
        getSettings: async () => ({}),
        saveSettings: async () => undefined,
        getHistory: async () => [],
        deleteEntry: async () => undefined,
        clearHistory: async () => undefined,
        retryTranscription: async () => undefined,
        copyToClipboard: async () => undefined,
        playAudio: async () => undefined,
        stopAudio: async () => undefined,
        getAudioPath: async () => '',
        showSettings: async () => undefined,
        showHistory: async () => undefined,
        quit: async () => undefined,
        startHotkeyCapture: async () => undefined,
        stopHotkeyCapture: async () => undefined,
        onStateUpdate: (callback: (state: unknown) => void) => {
          stateListeners.push(callback);
          return () => {
            const idx = stateListeners.indexOf(callback);
            if (idx >= 0) stateListeners.splice(idx, 1);
          };
        },
        onOverlayUpdate: () => () => undefined,
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({
          recordingState: 'idle',
          history: [],
          isMicrophoneGranted: true,
        }),
      };

      Object.assign(window as Window & { api?: unknown; __emitState?: (state: unknown) => void }, {
        api,
        __emitState: (state: unknown) => {
          for (const listener of stateListeners) listener(state);
        },
      });
    });

    await page.goto('index.html?view=tray-menu');
  });

  test('starts in idle ready status', async ({ page }) => {
    await expect(page.getByText('Ready')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Recording (F5)' })).toBeVisible();
  });

  test('shows recording status after state transition', async ({ page }) => {
    await page.evaluate(() => {
      (window as Window & { __emitState?: (state: unknown) => void }).__emitState?.({
        recordingState: 'recording',
        history: [],
        isMicrophoneGranted: true,
      });
    });

    await expect(page.getByText('Recording...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop Recording' })).toBeVisible();
  });

  test('shows transcribing status and cancel action', async ({ page }) => {
    await page.evaluate(() => {
      (window as Window & { __emitState?: (state: unknown) => void }).__emitState?.({
        recordingState: 'transcribing',
        history: [],
        isMicrophoneGranted: true,
      });
    });

    await expect(page.getByText('Transcribing...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('shows processing status text', async ({ page }) => {
    await page.evaluate(() => {
      (window as Window & { __emitState?: (state: unknown) => void }).__emitState?.({
        recordingState: 'processing',
        history: [],
        isMicrophoneGranted: true,
      });
    });

    await expect(page.getByText('Processing...')).toBeVisible();
  });

  test('returns to ready status after idle transition', async ({ page }) => {
    await page.evaluate(() => {
      const win = window as Window & { __emitState?: (state: unknown) => void };
      win.__emitState?.({ recordingState: 'recording', history: [], isMicrophoneGranted: true });
      win.__emitState?.({ recordingState: 'idle', history: [], isMicrophoneGranted: true });
    });

    await expect(page.getByText('Ready')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Recording (F5)' })).toBeVisible();
  });
});
