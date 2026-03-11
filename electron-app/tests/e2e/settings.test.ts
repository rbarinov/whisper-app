import { test, expect } from '@playwright/test';

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
        quit: async () => undefined,
        startHotkeyCapture: async () => undefined,
        stopHotkeyCapture: async () => undefined,
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
    await expect(page.getByText('Base URL')).toBeVisible();
    await expect(page.getByText('API Key')).toBeVisible();
    await expect(page.getByPlaceholder('https://api.openai.com')).toHaveValue('https://api.openai.com');
  });

  test('renders model and language inputs', async ({ page }) => {
    await expect(page.getByText('Model', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('whisper-1')).toHaveValue('whisper-1');
    await expect(page.getByPlaceholder('en, ru, de, ...')).toHaveValue('en');
  });

  test('renders hotkey controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Hotkey' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
    await expect(page.getByText('F5')).toBeVisible();
  });

  test('updates settings through saveSettings when edited', async ({ page }) => {
    const apiUrlInput = page.getByPlaceholder('https://api.openai.com');
    await apiUrlInput.fill('https://example.local');

    const saveCallCount = await page.evaluate(() => (window as Window & { __saveCalls?: unknown[] }).__saveCalls?.length ?? 0);
    expect(saveCallCount).toBeGreaterThan(0);
  });
});
