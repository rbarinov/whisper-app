import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/Button';
import type { AppSettings, AppState } from '../../shared/types';
import { DEFAULT_LLM_SYSTEM_PROMPT, DEFAULT_LLM_MODEL_NAME, DEFAULT_HOTKEY_KEY_NAME } from '../../shared/constants';

/** Settings window React form — port of Swift SettingsView */
export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isMicrophoneGranted, setIsMicrophoneGranted] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureTimeout, setCaptureTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.api.getSettings().then((s) => setSettings(s));
    window.api.getAppState().then((state) => {
      const appState = state as AppState;
      if (typeof appState?.isMicrophoneGranted === 'boolean') {
        setIsMicrophoneGranted(appState.isMicrophoneGranted);
      }
    });

    const unsubscribe = window.api.onStateUpdate((state) => {
      const appState = state as AppState;
      if (typeof appState?.isMicrophoneGranted === 'boolean') {
        setIsMicrophoneGranted(appState.isMicrophoneGranted);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isCapturing) return;
    const unsubscribe = window.api.onHotkeyCaptured((key: string) => {
      const parsed = JSON.parse(key) as { keyCode: number; keyName: string };
      setSettings((s) =>
        s ? { ...s, hotkeyConfig: { keyCode: parsed.keyCode, keyName: parsed.keyName } } : s
      );
      setIsCapturing(false);
      if (captureTimeout) clearTimeout(captureTimeout);
    });
    return () => {
      unsubscribe();
    };
  }, [isCapturing, captureTimeout]);

  const save = useCallback(
    (updated: AppSettings) => {
      setSettings(updated);
      window.api.saveSettings(updated);
    },
    []
  );

  const startCapture = () => {
    setIsCapturing(true);
    window.api.startHotkeyCapture();
    const t = setTimeout(() => setIsCapturing(false), 30000);
    setCaptureTimeout(t);
  };

  const requestMicrophonePermission = async () => {
    const granted = await window.api.requestMicrophonePermission();
    setIsMicrophoneGranted(granted);
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  const isDefaultSystemPrompt = settings.llmSystemPrompt === DEFAULT_LLM_SYSTEM_PROMPT;
  const isDefaultHotkey = settings.hotkeyConfig.keyName === DEFAULT_HOTKEY_KEY_NAME;

  return (
    <div className="p-4 bg-white min-h-screen text-gray-900 font-sans text-sm">
      <h1 className="text-lg font-semibold mb-4">Settings</h1>

      {/* API Configuration */}
      <section className="mb-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">API Configuration</h2>
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-gray-600">Base URL</span>
            <input
              type="text"
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="https://api.openai.com"
              value={settings.apiBaseURL}
              onChange={(e) => save({ ...settings, apiBaseURL: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">API Key</span>
            <input
              type="password"
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="sk-..."
              value={settings.apiKey}
              onChange={(e) => save({ ...settings, apiKey: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Model</span>
            <input
              type="text"
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="whisper-1"
              value={settings.modelName}
              onChange={(e) => save({ ...settings, modelName: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Language (ISO-639-1, empty = auto)</span>
            <input
              type="text"
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="en, ru, de, ..."
              value={settings.language}
              onChange={(e) => save({ ...settings, language: e.target.value })}
            />
          </label>
        </div>
      </section>

      {/* LLM Post-Processing */}
      <section className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase">LLM Post-Processing</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.llmPostProcessingEnabled}
              onChange={(e) =>
                save({ ...settings, llmPostProcessingEnabled: e.target.checked })
              }
            />
            <span className="text-xs">Enable</span>
          </label>
        </div>
        <div className={settings.llmPostProcessingEnabled ? '' : 'opacity-50 pointer-events-none'}>
          <label className="block mb-2">
            <span className="text-xs text-gray-600">LLM Model</span>
            <input
              type="text"
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder={DEFAULT_LLM_MODEL_NAME}
              value={settings.llmModelName}
              onChange={(e) => save({ ...settings, llmModelName: e.target.value })}
            />
          </label>
          <label className="block">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">System Prompt</span>
              {!isDefaultSystemPrompt && (
                <button
                  className="text-xs text-blue-500 hover:underline"
                  onClick={() =>
                    save({ ...settings, llmSystemPrompt: DEFAULT_LLM_SYSTEM_PROMPT })
                  }
                >
                  Reset to Default
                </button>
              )}
            </div>
            <textarea
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm h-24 resize-none"
              value={settings.llmSystemPrompt}
              onChange={(e) => save({ ...settings, llmSystemPrompt: e.target.value })}
            />
          </label>
        </div>
      </section>

      {/* Hotkey */}
      <section className="mb-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Hotkey</h2>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-gray-100 border border-gray-300 rounded font-mono text-sm">
            {isCapturing ? 'Press any key...' : settings.hotkeyConfig.keyName}
          </span>
          <Button size="sm" variant="secondary" onClick={startCapture} disabled={isCapturing}>
            Change
          </Button>
          {!isDefaultHotkey && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                save({
                  ...settings,
                  hotkeyConfig: { keyCode: 63, keyName: DEFAULT_HOTKEY_KEY_NAME },
                })
              }
            >
              Reset to F5
            </Button>
          )}
        </div>
      </section>

      {/* Microphone */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Permissions</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isMicrophoneGranted ? 'text-green-600' : 'text-yellow-600'}`}>
              {isMicrophoneGranted ? '✅' : '⚠️'}
            </span>
            <span className={`text-xs ${isMicrophoneGranted ? 'text-green-700' : 'text-yellow-700'}`}>
              {isMicrophoneGranted ? 'Microphone access granted' : 'Microphone access not granted'}
            </span>
          </div>
          {!isMicrophoneGranted && (
            <Button size="sm" variant="secondary" onClick={requestMicrophonePermission}>
              Request Permission
            </Button>
          )}
        </div>
        {!isMicrophoneGranted && (
          <p className="text-xs text-gray-500 mt-2">
            If denied, enable in System Settings → Privacy &amp; Security → Microphone.
          </p>
        )}
      </section>
    </div>
  );
}
