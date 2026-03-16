/**
 * Settings persistence service for the Electron main process.
 * Reads/writes settings.json in the platform-appropriate userData directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { AppSettings, HotkeyModifiers } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';

/**
 * macOS virtual keyCode for well-known key names.
 * On Apple Silicon, F5 = 176 (same as Swift app default).
 */
const MAC_KEY_NAME_TO_CODE: Record<string, number> = {
  F1: 122, F2: 120, F3: 160, F4: 177, F5: 176, F6: 178,
  F7: 98, F8: 100, F9: 101, F10: 109, F11: 103, F12: 111,
  Escape: 53,
  Space: 49,
  Tab: 48,
  Enter: 36,
  Backspace: 51,
  Delete: 117,
  Home: 115,
  End: 119,
  PageUp: 116,
  PageDown: 121,
  ArrowUp: 126,
  ArrowDown: 125,
  ArrowLeft: 123,
  ArrowRight: 124,
};

/**
 * uiohook-napi keyCodes for well-known key names.
 * Used on non-macOS platforms (Linux, Windows).
 */
const UIOHOOK_KEY_NAME_TO_CODE: Record<string, number> = {
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
  Escape: 1,
  Space: 57,
  Tab: 15,
  Enter: 28,
  Backspace: 14,
  Delete: 57427,
  Home: 57415,
  End: 57423,
  PageUp: 57417,
  PageDown: 57425,
  ArrowUp: 57416,
  ArrowDown: 57424,
  ArrowLeft: 57419,
  ArrowRight: 57421,
};

/**
 * Normalize the saved keyCode to the correct platform-specific value.
 *
 * The Swift app saves macOS virtual keyCodes (e.g. 176 for F5 on Apple Silicon).
 * On macOS we use those directly (via native CGEvent tap bridge).
 * On other platforms we map keyName → uiohook keyCode.
 */
function normalizeHotkeyCode(savedCode: number | undefined, keyName: string): number {
  if (process.platform === 'darwin') {
    // macOS: accept saved code as-is (it's a macOS virtual keyCode)
    // If missing, map from keyName
    if (savedCode !== undefined && savedCode > 0) return savedCode;
    if (keyName in MAC_KEY_NAME_TO_CODE) return MAC_KEY_NAME_TO_CODE[keyName];
    return DEFAULT_SETTINGS.hotkeyConfig.keyCode;
  }

  // Non-macOS: map keyName → uiohook keyCode
  if (keyName in UIOHOOK_KEY_NAME_TO_CODE) return UIOHOOK_KEY_NAME_TO_CODE[keyName];
  // Fallback: use saved code if it looks like a uiohook code, otherwise default
  if (savedCode !== undefined && savedCode > 0 && savedCode < 256) return savedCode;
  return DEFAULT_SETTINGS.hotkeyConfig.keyCode;
}

function normalizeCancelKeyCode(savedCode: number | undefined, keyName: string): number {
  if (process.platform === 'darwin') {
    if (savedCode !== undefined && savedCode > 0) return savedCode;
    if (keyName in MAC_KEY_NAME_TO_CODE) return MAC_KEY_NAME_TO_CODE[keyName];
    return DEFAULT_SETTINGS.cancelKeyConfig.keyCode;
  }

  if (keyName in UIOHOOK_KEY_NAME_TO_CODE) return UIOHOOK_KEY_NAME_TO_CODE[keyName];
  if (savedCode !== undefined && savedCode > 0 && savedCode < 65536) return savedCode;
  if (DEFAULT_SETTINGS.cancelKeyConfig.keyName in UIOHOOK_KEY_NAME_TO_CODE) {
    return UIOHOOK_KEY_NAME_TO_CODE[DEFAULT_SETTINGS.cancelKeyConfig.keyName];
  }
  return DEFAULT_SETTINGS.cancelKeyConfig.keyCode;
}

function buildDefaultSettingsForPlatform(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    hotkeyConfig: {
      ...DEFAULT_SETTINGS.hotkeyConfig,
      keyCode: normalizeHotkeyCode(DEFAULT_SETTINGS.hotkeyConfig.keyCode, DEFAULT_SETTINGS.hotkeyConfig.keyName),
    },
    cancelKeyConfig: {
      ...DEFAULT_SETTINGS.cancelKeyConfig,
      keyCode: normalizeCancelKeyCode(DEFAULT_SETTINGS.cancelKeyConfig.keyCode, DEFAULT_SETTINGS.cancelKeyConfig.keyName),
    },
  };
}

function normalizeModifiers(modifiers: unknown): HotkeyModifiers | undefined {
  if (!modifiers || typeof modifiers !== 'object') {
    return undefined;
  }

  const source = modifiers as Record<string, unknown>;
  const normalized: HotkeyModifiers = {
    ctrl: !!source.ctrl,
    alt: !!source.alt,
    shift: !!source.shift,
    meta: !!source.meta,
  };

  if (!normalized.ctrl && !normalized.alt && !normalized.shift && !normalized.meta) {
    return undefined;
  }

  return normalized;
}

/**
 * Get the path where settings.json should be stored.
 * Uses app.getPath('userData') for platform-specific app data directory.
 */
export function getSettingsPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
}

/**
 * Load settings from disk. If file doesn't exist or is invalid,
 * returns DEFAULT_SETTINGS. Missing fields are filled from defaults.
 */
export function loadSettings(): AppSettings {
  try {
    const filePath = getSettingsPath();
    
    // Try to read the file
    if (!fs.existsSync(filePath)) {
      return buildDefaultSettingsForPlatform();
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const fileSettings = JSON.parse(fileContent);
    
    // Merge with defaults to handle missing fields
    return {
      apiBaseURL: fileSettings.apiBaseURL ?? DEFAULT_SETTINGS.apiBaseURL,
      apiKey: fileSettings.apiKey ?? DEFAULT_SETTINGS.apiKey,
      modelName: fileSettings.modelName ?? DEFAULT_SETTINGS.modelName,
      language: fileSettings.language ?? DEFAULT_SETTINGS.language,
      hotkeyConfig: {
        keyCode: normalizeHotkeyCode(fileSettings.hotkeyConfig?.keyCode, fileSettings.hotkeyConfig?.keyName ?? DEFAULT_SETTINGS.hotkeyConfig.keyName),
        keyName: fileSettings.hotkeyConfig?.keyName ?? DEFAULT_SETTINGS.hotkeyConfig.keyName,
        modifiers: normalizeModifiers(fileSettings.hotkeyConfig?.modifiers),
      },
      cancelKeyConfig: {
        keyCode: normalizeCancelKeyCode(fileSettings.cancelKeyConfig?.keyCode, fileSettings.cancelKeyConfig?.keyName ?? DEFAULT_SETTINGS.cancelKeyConfig.keyName),
        keyName: fileSettings.cancelKeyConfig?.keyName ?? DEFAULT_SETTINGS.cancelKeyConfig.keyName,
        modifiers: normalizeModifiers(fileSettings.cancelKeyConfig?.modifiers),
      },
      llmPostProcessingEnabled: fileSettings.llmPostProcessingEnabled ?? DEFAULT_SETTINGS.llmPostProcessingEnabled,
      llmApiBaseURL: fileSettings.llmApiBaseURL ?? DEFAULT_SETTINGS.llmApiBaseURL,
      llmApiKey: fileSettings.llmApiKey ?? DEFAULT_SETTINGS.llmApiKey,
      llmModelName: fileSettings.llmModelName ?? DEFAULT_SETTINGS.llmModelName,
      llmSystemPrompt: fileSettings.llmSystemPrompt ?? DEFAULT_SETTINGS.llmSystemPrompt,
      onboardingCompleted: fileSettings.onboardingCompleted ?? DEFAULT_SETTINGS.onboardingCompleted,
    };
  } catch (error) {
    // On any error (file not found, invalid JSON, etc.), return defaults
    return buildDefaultSettingsForPlatform();
  }
}

/**
 * Save settings to disk atomically.
 * Writes to a temporary file first, then renames it to avoid corruption.
 */
export function saveSettings(settings: AppSettings): void {
  try {
    const filePath = getSettingsPath();
    const dirPath = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Write to temp file first
    const tempPath = `${filePath}.tmp`;
    const jsonContent = JSON.stringify(settings, null, 2);
    fs.writeFileSync(tempPath, jsonContent, 'utf-8');
    
    // Atomic rename
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}
