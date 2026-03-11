import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { LegalNotice } from '../components/LegalNotice';
import { WindowChrome } from '../components/WindowChrome';
import type { AppSettings } from '../../shared/types';
import { DEFAULT_LLM_MODEL_NAME, DEFAULT_LLM_SYSTEM_PROMPT } from '../../shared/constants';

type PermissionState = {
  microphone: 'granted' | 'denied' | 'not-determined';
  accessibility: boolean;
};

const DEFAULT_PERMISSIONS: PermissionState = {
  microphone: 'not-determined',
  accessibility: false,
};

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'tr', label: 'Turkish' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
];

function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-help">{hint}</span> : null}
    </label>
  );
}

function PermissionRow({
  title,
  description,
  granted,
  children,
}: {
  title: string;
  description: string;
  granted: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[#15231e]/8 bg-white/70 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#16211b]">{title}</p>
          <p className="mt-1 text-sm leading-5 text-[#4b5650]">{description}</p>
        </div>
        <span className={`status-pill flex-none ${granted ? 'status-pill--ready' : 'status-pill--pending'}`}>
          {granted ? 'Granted' : 'Needed'}
        </span>
      </div>
      {children ? <div className="mt-2.5 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [permissions, setPermissions] = useState<PermissionState>(DEFAULT_PERMISSIONS);

  const refreshPermissions = useCallback(async () => {
    const latest = await window.api.checkPermissions();
    setPermissions(latest);
    return latest;
  }, []);

  useEffect(() => {
    void window.api.getSettings().then((s) => setSettings(s));
    void refreshPermissions();

    const unsubscribe = window.api.onStateUpdate(() => {
      void refreshPermissions();
    });

    return () => {
      unsubscribe();
    };
  }, [refreshPermissions]);

  const save = useCallback(
    (updated: AppSettings) => {
      setSettings(updated);
      void window.api.saveSettings(updated);
    },
    []
  );

  const requestMicrophonePermission = async () => {
    await window.api.requestMicrophonePermission();
    await refreshPermissions();
  };

  const openAccessibilitySettings = async () => {
    await window.api.requestAccessibility();
    await window.api.openAccessibilitySettings();
    await refreshPermissions();
  };

  if (!settings) {
    return (
      <div className="app-shell app-shell--flush">
        <div className="window-panel window-panel--flush">
          <div className="window-content flex h-full items-center justify-center p-6">
            <div className="section-card px-6 py-5 text-center">
              <p className="hero-kicker">Configuration</p>
              <p className="mt-3 text-sm text-[#4b5650]">Loading settings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isDefaultSystemPrompt = settings.llmSystemPrompt === DEFAULT_LLM_SYSTEM_PROMPT;
  const isMicrophoneGranted = permissions.microphone === 'granted';
  const isAccessibilityGranted = permissions.accessibility;
  const llmUsesPrimaryEndpoint = !settings.llmApiBaseURL.trim();
  const llmUsesPrimaryKey = !settings.llmApiKey.trim();

  return (
    <div className="app-shell app-shell--flush">
      <div className="window-panel window-panel--flush">
        <div className="window-content overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full min-w-0 flex-col">
            <div className="px-4 pt-3">
              <WindowChrome label="Settings" />
            </div>

            <header className="border-b border-[#15231e]/6 px-4 pb-3 pt-1.5">
              <div className="max-w-[26rem]">
                <h1 className="view-title text-[2.4rem]">Settings</h1>
              </div>
            </header>

            <div className="flex-1 px-4 py-4">
              <div className="mx-auto grid max-w-6xl gap-3 min-[980px]:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.8fr)]">
                <section className="section-card p-3.5">
                  <div className="mb-2.5">
                    <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#16211b]">API Configuration</h2>
                    <p className="mt-1 text-sm leading-5 text-[#4b5650]">Main Whisper transcription endpoint.</p>
                  </div>
                  <div className="space-y-2.5">
                    <SettingsField label="Base URL">
                      <input
                        type="text"
                        className="field-control text-sm"
                        placeholder="https://api.openai.com"
                        value={settings.apiBaseURL}
                        onChange={(e) => save({ ...settings, apiBaseURL: e.target.value })}
                      />
                    </SettingsField>
                    <SettingsField label="API Key">
                      <input
                        type="password"
                        className="field-control text-sm"
                        placeholder="sk-..."
                        value={settings.apiKey}
                        onChange={(e) => save({ ...settings, apiKey: e.target.value })}
                      />
                    </SettingsField>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <SettingsField label="Model">
                        <input
                          type="text"
                          className="field-control text-sm"
                          placeholder="whisper-1"
                          value={settings.modelName}
                          onChange={(e) => save({ ...settings, modelName: e.target.value })}
                        />
                      </SettingsField>
                      <SettingsField label="Language">
                        <select
                          className="field-control text-sm"
                          value={settings.language}
                          onChange={(e) => save({ ...settings, language: e.target.value })}
                        >
                          {LANGUAGE_OPTIONS.map((option) => (
                            <option key={option.value || 'auto'} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </SettingsField>
                    </div>
                  </div>
                </section>

                <section className="section-card p-3.5">
                  <div className="mb-2.5">
                    <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#16211b]">Permissions</h2>
                    <p className="mt-1 text-sm leading-5 text-[#4b5650]">Microphone and accessibility access.</p>
                  </div>

                  <div className="space-y-2.5">
                    <PermissionRow
                      title="Microphone"
                      description={
                        isMicrophoneGranted
                          ? 'Ready to record audio.'
                          : 'Needed to capture your voice before transcription.'
                      }
                      granted={isMicrophoneGranted}
                    >
                      {!isMicrophoneGranted ? (
                        <Button size="sm" variant="secondary" onClick={requestMicrophonePermission}>
                          Request access
                        </Button>
                      ) : null}
                    </PermissionRow>

                    <PermissionRow
                      title="Accessibility"
                      description={
                        isAccessibilityGranted
                          ? 'Ready for the system-wide shortcut.'
                          : 'Needed so recording can start while you work in another app.'
                      }
                      granted={isAccessibilityGranted}
                    >
                      {!isAccessibilityGranted ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={openAccessibilitySettings}>
                            Open Settings
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => void refreshPermissions()}>
                            Refresh
                          </Button>
                        </>
                      ) : null}
                    </PermissionRow>
                  </div>
                </section>

                <section className="section-card p-3.5 min-[980px]:col-span-2">
                  <div className="mb-3 flex flex-col gap-2.5 min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between">
                    <div>
                      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#16211b]">LLM Post-Processing</h2>
                      <p className="mt-1 text-sm leading-5 text-[#4b5650]">
                        Optional cleanup step after Whisper transcription.
                      </p>
                    </div>
                    <label className="flex items-center gap-3 rounded-full border border-[#15231e]/8 bg-white/70 px-3 py-2">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={settings.llmPostProcessingEnabled}
                        onChange={(e) => save({ ...settings, llmPostProcessingEnabled: e.target.checked })}
                      />
                      <span className="relative inline-flex h-7 w-12 items-center rounded-full bg-[#15231e]/10 transition-colors duration-200 peer-checked:bg-[#15231e]">
                        <span
                          className={`absolute left-1 h-5 w-5 rounded-full bg-white shadow-[0_6px_14px_rgba(0,0,0,0.12)] transition-transform duration-200 ${
                            settings.llmPostProcessingEnabled ? 'translate-x-5' : ''
                          }`}
                        />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4b5650]">
                        {settings.llmPostProcessingEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2.5">
                    <SettingsField label="LLM Model">
                      <input
                        type="text"
                        className="field-control text-sm"
                        placeholder={DEFAULT_LLM_MODEL_NAME}
                        value={settings.llmModelName}
                        onChange={(e) => save({ ...settings, llmModelName: e.target.value })}
                      />
                    </SettingsField>

                    <SettingsField
                      label="Custom Base URL"
                      hint={llmUsesPrimaryEndpoint ? 'Blank uses the API Configuration base URL.' : 'Overrides the main transcription base URL.'}
                    >
                      <input
                        type="text"
                        className="field-control text-sm"
                        placeholder="Leave blank to reuse API Configuration"
                        value={settings.llmApiBaseURL}
                        onChange={(e) => save({ ...settings, llmApiBaseURL: e.target.value })}
                      />
                    </SettingsField>

                    <SettingsField
                      label="Custom API Key"
                      hint={llmUsesPrimaryKey ? 'Blank uses the API Configuration API key.' : 'Overrides the main transcription API key.'}
                    >
                      <input
                        type="password"
                        className="field-control text-sm"
                        placeholder="Leave blank to reuse API Configuration"
                        value={settings.llmApiKey}
                        onChange={(e) => save({ ...settings, llmApiKey: e.target.value })}
                      />
                    </SettingsField>

                    <label className="block">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <span className="field-label mb-0">System Prompt</span>
                        {!isDefaultSystemPrompt && (
                          <button
                            type="button"
                            className="action-link"
                            onClick={() => save({ ...settings, llmSystemPrompt: DEFAULT_LLM_SYSTEM_PROMPT })}
                          >
                            Reset to Default
                          </button>
                        )}
                      </div>
                      <textarea
                        className="field-control field-textarea min-h-[220px] text-sm"
                        value={settings.llmSystemPrompt}
                        onChange={(e) => save({ ...settings, llmSystemPrompt: e.target.value })}
                      />
                    </label>
                  </div>
                </section>

                <LegalNotice className="min-[980px]:col-span-2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
