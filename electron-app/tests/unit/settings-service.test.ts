import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AppSettings } from '../../src/shared/types';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';

/**
 * Platform-aware expected keyCode helper.
 * On macOS, loadSettings() passes through the saved keyCode as-is.
 * On non-macOS, loadSettings() maps keyName → uiohook keyCode (ignoring saved value).
 */
const UIOHOOK_KEY_NAME_TO_CODE: Record<string, number> = {
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
  Escape: 1,
};

function expectedKeyCode(savedCode: number, keyName: string): number {
  if (process.platform === 'darwin') return savedCode;
  return UIOHOOK_KEY_NAME_TO_CODE[keyName] ?? savedCode;
}

function expectedDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    hotkeyConfig: {
      ...DEFAULT_SETTINGS.hotkeyConfig,
      keyCode: expectedKeyCode(DEFAULT_SETTINGS.hotkeyConfig.keyCode, DEFAULT_SETTINGS.hotkeyConfig.keyName),
    },
    cancelKeyConfig: {
      ...DEFAULT_SETTINGS.cancelKeyConfig,
      keyCode: expectedKeyCode(DEFAULT_SETTINGS.cancelKeyConfig.keyCode, DEFAULT_SETTINGS.cancelKeyConfig.keyName),
    },
  };
}

// Mock electron module before importing settings-service
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => tempDir),
  },
}));

// Now import the service after mocking electron
import { loadSettings, saveSettings, getSettingsPath } from '../../src/main/services/settings-service';
import { app } from 'electron';

let tempDir: string;

describe('Settings Service', () => {
  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-settings-'));
    vi.mocked(app.getPath).mockReturnValue(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory after each test
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('getSettingsPath', () => {
    it('should return the settings.json path in userData directory', () => {
      const settingsPath = getSettingsPath();
      expect(settingsPath).toBe(path.join(tempDir, 'settings.json'));
    });

    it('should include settings.json filename', () => {
      const settingsPath = getSettingsPath();
      expect(settingsPath).toContain('settings.json');
    });
  });

  describe('loadSettings', () => {
    it('should return DEFAULT_SETTINGS when file does not exist', () => {
      const settings = loadSettings();
      expect(settings).toEqual(expectedDefaultSettings());
    });

    it('should load settings from file when it exists', () => {
      const testSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiBaseURL: 'https://custom.api.com',
        apiKey: 'sk-test-key-123',
        modelName: 'whisper-v2',
        language: 'ru',
        hotkeyConfig: {
          keyCode: 49,
          keyName: 'F7',
          modifiers: { ctrl: true, alt: false, shift: true, meta: false },
        },
        cancelKeyConfig: {
          keyCode: 53,
          keyName: 'Escape',
          modifiers: undefined,
        },
        llmPostProcessingEnabled: true,
        llmApiBaseURL: 'https://llm.custom.api.com',
        llmApiKey: 'sk-llm-key-456',
        llmModelName: 'gpt-4',
        llmSystemPrompt: 'Custom prompt',
      };

      // Write test settings to file
      const settingsPath = getSettingsPath();
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));

      // Load and verify — keyCode is platform-normalized
      const loaded = loadSettings();
      expect(loaded).toEqual({
        ...testSettings,
        hotkeyConfig: {
          ...testSettings.hotkeyConfig,
          keyCode: expectedKeyCode(49, 'F7'),
        },
        cancelKeyConfig: {
          ...testSettings.cancelKeyConfig,
          keyCode: expectedKeyCode(53, 'Escape'),
        },
      });
    });

    it('should handle partial data by filling missing fields from defaults', () => {
      // Write only some fields to file
      const partialSettings = {
        apiKey: 'sk-custom-key',
        modelName: 'custom-model',
      };

      const settingsPath = getSettingsPath();
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(partialSettings));

      // Load and verify defaults are filled in
      const loaded = loadSettings();
      expect(loaded.apiKey).toBe('sk-custom-key');
      expect(loaded.modelName).toBe('custom-model');
      expect(loaded.apiBaseURL).toBe(DEFAULT_SETTINGS.apiBaseURL);
      expect(loaded.language).toBe(DEFAULT_SETTINGS.language);
      expect(loaded.hotkeyConfig).toEqual({
        ...DEFAULT_SETTINGS.hotkeyConfig,
        keyCode: expectedKeyCode(DEFAULT_SETTINGS.hotkeyConfig.keyCode, DEFAULT_SETTINGS.hotkeyConfig.keyName),
      });
      expect(loaded.cancelKeyConfig).toEqual({
        ...DEFAULT_SETTINGS.cancelKeyConfig,
        keyCode: expectedKeyCode(DEFAULT_SETTINGS.cancelKeyConfig.keyCode, DEFAULT_SETTINGS.cancelKeyConfig.keyName),
      });
      expect(loaded.llmPostProcessingEnabled).toBe(DEFAULT_SETTINGS.llmPostProcessingEnabled);
      expect(loaded.llmApiBaseURL).toBe(DEFAULT_SETTINGS.llmApiBaseURL);
      expect(loaded.llmApiKey).toBe(DEFAULT_SETTINGS.llmApiKey);
      expect(loaded.llmModelName).toBe(DEFAULT_SETTINGS.llmModelName);
      expect(loaded.llmSystemPrompt).toBe(DEFAULT_SETTINGS.llmSystemPrompt);
    });

    it('should return defaults on invalid JSON', () => {
      // Write invalid JSON to file
      const settingsPath = getSettingsPath();
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, 'invalid json {]');

      // Load should return defaults instead of throwing
      const loaded = loadSettings();
      expect(loaded).toEqual(expectedDefaultSettings());
    });

    it('should handle nested hotkeyConfig with missing fields', () => {
      const partialSettings = {
        hotkeyConfig: {
          keyCode: 42,
          // keyName missing
        },
      };

      const settingsPath = getSettingsPath();
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(partialSettings));

      const loaded = loadSettings();
      expect(loaded.hotkeyConfig.keyCode).toBe(expectedKeyCode(42, DEFAULT_SETTINGS.hotkeyConfig.keyName));
      expect(loaded.hotkeyConfig.keyName).toBe(DEFAULT_SETTINGS.hotkeyConfig.keyName);
      expect(loaded.hotkeyConfig.modifiers).toBeUndefined();
    });

    it('should load hotkey modifiers when present', () => {
      const settingsPath = getSettingsPath();
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(
        settingsPath,
        JSON.stringify({
          hotkeyConfig: {
            keyCode: 63,
            keyName: 'F5',
            modifiers: { ctrl: true, shift: true },
          },
          cancelKeyConfig: {
            keyCode: 1,
            keyName: 'Escape',
            modifiers: { alt: true },
          },
        })
      );

      const loaded = loadSettings();
      expect(loaded.hotkeyConfig.modifiers).toEqual({ ctrl: true, alt: false, shift: true, meta: false });
      expect(loaded.cancelKeyConfig.modifiers).toEqual({ ctrl: false, alt: true, shift: false, meta: false });
    });
  });

  describe('saveSettings', () => {
    it('should create file if it does not exist', () => {
      const testSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'sk-new-key',
      };

      saveSettings(testSettings);

      const settingsPath = getSettingsPath();
      expect(fs.existsSync(settingsPath)).toBe(true);
    });

    it('should write valid JSON to file', () => {
      const testSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'sk-test',
        modelName: 'test-model',
      };

      saveSettings(testSettings);

      const settingsPath = getSettingsPath();
      const fileContent = fs.readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(fileContent);

      expect(parsed.apiKey).toBe('sk-test');
      expect(parsed.modelName).toBe('test-model');
    });

    it('should preserve all fields in roundtrip (save then load)', () => {
      const testSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiBaseURL: 'https://test.api.com',
        apiKey: 'sk-roundtrip-test',
        modelName: 'whisper-test',
        language: 'en',
        hotkeyConfig: {
          keyCode: 100,
          keyName: 'F10',
          modifiers: { ctrl: true, alt: true, shift: false, meta: false },
        },
        cancelKeyConfig: {
          keyCode: 53,
          keyName: 'Escape',
          modifiers: { ctrl: false, alt: false, shift: true, meta: false },
        },
        llmPostProcessingEnabled: true,
        llmApiBaseURL: 'https://llm.test.api.com',
        llmApiKey: 'sk-llm-roundtrip',
        llmModelName: 'gpt-test',
        llmSystemPrompt: 'Test prompt',
      };

      // Save
      saveSettings(testSettings);

      // Load
      const loaded = loadSettings();

      // Verify all fields — keyCode is platform-normalized
      expect(loaded).toEqual({
        ...testSettings,
        hotkeyConfig: {
          ...testSettings.hotkeyConfig,
          keyCode: expectedKeyCode(100, 'F10'),
        },
        cancelKeyConfig: {
          ...testSettings.cancelKeyConfig,
          keyCode: expectedKeyCode(53, 'Escape'),
        },
      });
    });

    it('should overwrite existing file', () => {
      const firstSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'sk-first',
      };

      const secondSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'sk-second',
      };

      // Save first, then second
      saveSettings(firstSettings);
      saveSettings(secondSettings);

      // Load and verify second is saved
      const loaded = loadSettings();
      expect(loaded.apiKey).toBe('sk-second');
    });

    it('should format JSON with pretty-printing', () => {
      const testSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'sk-format-test',
      };

      saveSettings(testSettings);

      const settingsPath = getSettingsPath();
      const fileContent = fs.readFileSync(settingsPath, 'utf-8');

      // Check for indentation (pretty-printing)
      expect(fileContent).toContain('\n');
      expect(fileContent).toMatch(/  "/); // 2-space indentation
    });

    it('should create directory structure if it does not exist', () => {
      const testSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'sk-mkdir-test',
      };

      // Ensure directory doesn't exist
      const settingsPath = getSettingsPath();
      const dirPath = path.dirname(settingsPath);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }

      // Should not throw when saving
      expect(() => {
        saveSettings(testSettings);
      }).not.toThrow();

      // Directory should now exist
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.existsSync(settingsPath)).toBe(true);
    });

    it('should use atomic writes (temp file pattern)', () => {
      const testSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiKey: 'sk-atomic-test',
      };

      const settingsPath = getSettingsPath();
      const tempPath = `${settingsPath}.tmp`;

      // Save settings
      saveSettings(testSettings);

      // Verify temp file was cleaned up (not left behind)
      expect(fs.existsSync(tempPath)).toBe(false);
      expect(fs.existsSync(settingsPath)).toBe(true);
    });
  });

  describe('Integration: save and load roundtrip', () => {
    it('should successfully save and restore complex settings', () => {
      const originalSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        apiBaseURL: 'https://integration.test.com',
        apiKey: 'sk-integration-key-12345',
        modelName: 'whisper-integration',
        language: 'fr',
        hotkeyConfig: {
          keyCode: 64, // UiohookKey.F6
          keyName: 'F6',
          modifiers: { ctrl: false, alt: false, shift: true, meta: false },
        },
        cancelKeyConfig: {
          keyCode: 53,
          keyName: 'Escape',
          modifiers: undefined,
        },
        llmPostProcessingEnabled: true,
        llmApiBaseURL: 'https://integration.llm.test.com',
        llmApiKey: 'sk-integration-llm-key',
        llmModelName: 'gpt-4-turbo',
        llmSystemPrompt: 'Integration test prompt with special chars: "quotes" and \\ backslashes',
      };

      // Save
      saveSettings(originalSettings);

      // Load
      const restored = loadSettings();

      // Verify complete equality — keyCode is platform-normalized
      expect(restored).toEqual({
        ...originalSettings,
        hotkeyConfig: {
          ...originalSettings.hotkeyConfig,
          keyCode: expectedKeyCode(64, 'F6'),
        },
        cancelKeyConfig: {
          ...originalSettings.cancelKeyConfig,
          keyCode: expectedKeyCode(53, 'Escape'),
        },
      });
      expect(restored.apiKey).toBe(originalSettings.apiKey);
      expect(restored.llmSystemPrompt).toBe(originalSettings.llmSystemPrompt);
    });
  });
});
