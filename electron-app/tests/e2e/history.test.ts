import { test, expect } from '@playwright/test';

test.describe('history view', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mocked: true }),
      });
    });
  });

  test('renders history heading', async ({ page }) => {
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
        onOverlayUpdate: () => () => undefined,
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=history');
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  });

  test('shows empty state message when history has no entries', async ({ page }) => {
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
        onOverlayUpdate: () => () => undefined,
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=history');
    await expect(page.getByText('No transcriptions yet')).toBeVisible();
    await expect(page.getByText('Hold F5 to record')).toBeVisible();
  });

  test('renders history entry content', async ({ page }) => {
    await page.addInitScript(() => {
      const api = {
        startRecording: async () => undefined,
        stopRecording: async () => undefined,
        cancelRecording: async () => undefined,
        sendRecordingData: () => undefined,
        getSettings: async () => ({}),
        saveSettings: async () => undefined,
        getHistory: async () => [
          {
            id: 'entry-1',
            timestamp: new Date().toISOString(),
            durationSeconds: 1.2,
            text: 'sample transcription',
            status: 'successful',
          },
        ],
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
        onOverlayUpdate: () => () => undefined,
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=history');
    await expect(page.getByText('sample transcription')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  });

  test('shows clear all button for non-empty history', async ({ page }) => {
    await page.addInitScript(() => {
      const api = {
        startRecording: async () => undefined,
        stopRecording: async () => undefined,
        cancelRecording: async () => undefined,
        sendRecordingData: () => undefined,
        getSettings: async () => ({}),
        saveSettings: async () => undefined,
        getHistory: async () => [
          {
            id: 'entry-2',
            timestamp: new Date().toISOString(),
            durationSeconds: 0.8,
            text: 'second entry',
            status: 'successful',
          },
        ],
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
        onOverlayUpdate: () => () => undefined,
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=history');
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeVisible();
  });

  test('shows retry action for failed entries with audio', async ({ page }) => {
    await page.addInitScript(() => {
      const api = {
        startRecording: async () => undefined,
        stopRecording: async () => undefined,
        cancelRecording: async () => undefined,
        sendRecordingData: () => undefined,
        getSettings: async () => ({}),
        saveSettings: async () => undefined,
        getHistory: async () => [
          {
            id: 'entry-3',
            timestamp: new Date().toISOString(),
            durationSeconds: 1,
            status: 'failed',
            errorMessage: 'network',
            audioFilePath: 'recordings/test.wav',
          },
        ],
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
        onOverlayUpdate: () => () => undefined,
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });

    await page.goto('index.html?view=history');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByRole('button', { name: '▶ Play' })).toBeVisible();
  });
});
