import { test, expect } from '@playwright/test';
import { APP_LEGAL_NOTICE, APP_REPOSITORY_URL } from '../../src/shared/version';

test.describe('renderer app launch', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mocked: true }),
      });
    });

    await page.addInitScript(() => {
      const listeners: Array<(state: unknown) => void> = [];
      const initialState = { recordingState: { type: 'idle' }, history: [] };

      const api = {
        startRecording: async () => undefined,
        stopRecording: async () => undefined,
        cancelRecording: async () => undefined,
        sendRecordingData: () => undefined,
        getSettings: async () => ({
          apiBaseURL: 'https://api.openai.com/v1',
          apiKey: '',
          modelName: 'whisper-1',
          language: '',
          hotkeyConfig: { keyCode: 63, keyName: 'F5', modifiers: undefined },
          cancelKeyConfig: { keyCode: 1, keyName: 'Escape', modifiers: undefined },
          llmPostProcessingEnabled: false,
          llmApiBaseURL: '',
          llmApiKey: '',
          llmModelName: 'gpt-5-nano',
          llmSystemPrompt: 'prompt',
        }),
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
        showOnboarding: async () => undefined,
        quit: async () => undefined,
        startHotkeyCapture: async () => undefined,
        stopHotkeyCapture: async () => undefined,
        checkPermissions: async () => ({ microphone: 'granted', accessibility: true }),
        requestMicrophonePermission: async () => true,
        requestAccessibility: async () => ({ microphone: 'granted', accessibility: true }),
        openAccessibilitySettings: async () => undefined,
        openExternalUrl: async () => undefined,
        onStateUpdate: (callback: (state: unknown) => void) => {
          listeners.push(callback);
          callback(initialState);
          return () => {
            const idx = listeners.indexOf(callback);
            if (idx >= 0) listeners.splice(idx, 1);
          };
        },
        onOverlayUpdate: (callback: (state: unknown) => void) => {
          callback({ type: 'hidden' });
          return () => undefined;
        },
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown }, { api });
    });
  });

  test('loads page title without fatal errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('index.html?view=settings');

    await expect(page).toHaveTitle('WhisperApp');
    expect(pageErrors).toEqual([]);
  });

  test('renders root app container', async ({ page }) => {
    await page.goto('index.html?view=settings');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('renders settings view by default', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('switches to history view via query param', async ({ page }) => {
    await page.goto('index.html?view=history');
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.getByText('No transcriptions yet')).toBeVisible();
  });

  test('switches to onboarding view via query param', async ({ page }) => {
    await page.goto('index.html?view=onboarding');
    await expect(page.getByRole('heading', { name: 'WhisperApp' })).toBeVisible();
    await expect(page.getByText(APP_LEGAL_NOTICE)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open GitHub repository' })).toHaveAttribute('href', APP_REPOSITORY_URL);
  });

  test('switches to overlay view via query param', async ({ page }) => {
    await page.goto('index.html?view=overlay');
    await expect(page).toHaveURL(/view=overlay/);
    await expect(page.locator('#root')).toBeAttached();
  });
});
