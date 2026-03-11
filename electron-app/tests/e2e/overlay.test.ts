import { test, expect } from '@playwright/test';

test.describe('overlay view', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mocked: true }),
      });
    });
  });

  test('renders recording indicator state', async ({ page }) => {
    await page.addInitScript(() => {
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
        onStateUpdate: () => () => undefined,
        onOverlayUpdate: (callback: (state: unknown) => void) => {
          callback({ type: 'recording' });
          return () => undefined;
        },
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=overlay');
    await expect(page.getByText('Recording...')).toBeVisible();
  });

  test('renders transcribing state text', async ({ page }) => {
    await page.addInitScript(() => {
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
        onStateUpdate: () => () => undefined,
        onOverlayUpdate: (callback: (state: unknown) => void) => {
          callback({ type: 'transcribing' });
          return () => undefined;
        },
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=overlay');
    await expect(page.getByText('Transcribing...')).toBeVisible();
  });

  test('renders done state text payload', async ({ page }) => {
    await page.addInitScript(() => {
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
        onStateUpdate: () => () => undefined,
        onOverlayUpdate: (callback: (state: unknown) => void) => {
          callback({ type: 'done', text: 'Finished transcript' });
          return () => undefined;
        },
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=overlay');
    await expect(page.getByText('Finished transcript')).toBeVisible();
  });

  test('renders error state message', async ({ page }) => {
    await page.addInitScript(() => {
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
        onStateUpdate: () => () => undefined,
        onOverlayUpdate: (callback: (state: unknown) => void) => {
          callback({ type: 'error', message: 'Microphone denied' });
          return () => undefined;
        },
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=overlay');
    await expect(page.getByText('Microphone denied')).toBeVisible();
  });

  test('renders cancelled state', async ({ page }) => {
    await page.addInitScript(() => {
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
        onStateUpdate: () => () => undefined,
        onOverlayUpdate: (callback: (state: unknown) => void) => {
          callback({ type: 'cancelled' });
          return () => undefined;
        },
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=overlay');
    await expect(page.getByText('Cancelled')).toBeVisible();
  });
});
