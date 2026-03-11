import { test, expect } from '@playwright/test';
import { APP_LEGAL_NOTICE, APP_REPOSITORY_URL } from '../../src/shared/version';

test.describe('settings view', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mocked: true }),
      });
    });

    await page.addInitScript(() => {
      const saveCalls: unknown[] = [];

      const api = {
        startRecording: async () => undefined,
        stopRecording: async () => undefined,
        cancelRecording: async () => undefined,
        sendRecordingData: () => undefined,
        getSettings: async () => ({
          apiBaseURL: 'https://api.openai.com',
          apiKey: 'sk-test',
          modelName: 'whisper-1',
          language: 'en',
          hotkeyConfig: { keyCode: 63, keyName: 'F5' },
          llmPostProcessingEnabled: false,
          llmApiBaseURL: '',
          llmApiKey: '',
          llmModelName: 'gpt-oss-20b',
          llmSystemPrompt: 'System prompt',
        }),
        saveSettings: async (settings: unknown) => {
          saveCalls.push(settings);
        },
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
        checkPermissions: async () => ({ microphone: 'granted', accessibility: false }),
        requestMicrophonePermission: async () => true,
        requestAccessibility: async () => ({ microphone: 'granted', accessibility: false }),
        openAccessibilitySettings: async () => undefined,
        openExternalUrl: async () => undefined,
        onStateUpdate: () => () => undefined,
        onOverlayUpdate: () => () => undefined,
        onHotkeyCaptured: () => () => undefined,
        onWaylandNotify: () => () => undefined,
        getAppState: async () => ({ recordingState: 'idle', history: [], isMicrophoneGranted: true }),
      };

      Object.assign(window as Window & { api?: unknown; __saveCalls?: unknown[] }, { api, __saveCalls: saveCalls });
    });

    await page.goto('index.html?view=settings');
  });

  test('renders settings form heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('renders API URL and API key inputs', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue('https://api.openai.com');
    await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('sk-test');
  });

  test('renders model and language inputs', async ({ page }) => {
    await expect(page.getByText('Model', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('whisper-1')).toHaveValue('whisper-1');
    await expect(page.getByLabel('Language')).toHaveValue('en');
  });

  test('renders permissions and llm fallback inputs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Permissions' })).toBeVisible();
    await expect(page.getByText('Accessibility', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Custom Base URL')).toHaveValue('');
    await expect(page.getByLabel('Custom API Key')).toHaveValue('');
    await expect(page.getByRole('heading', { name: 'Hotkey' })).toHaveCount(0);
  });

  test('renders legal notice', async ({ page }) => {
    await expect(page.getByText(APP_LEGAL_NOTICE)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open GitHub repository' })).toHaveAttribute('href', APP_REPOSITORY_URL);
  });

  test('updates settings through saveSettings when edited', async ({ page }) => {
    const apiUrlInput = page.getByPlaceholder('https://api.openai.com');
    await apiUrlInput.fill('https://example.local');

    const saveCallCount = await page.evaluate(() => (window as Window & { __saveCalls?: unknown[] }).__saveCalls?.length ?? 0);
    expect(saveCallCount).toBeGreaterThan(0);
  });
});
