import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { WindowChrome } from '../components/WindowChrome';
import type { AppSettings } from '../../shared/types';
import { DEFAULT_API_BASE_URL } from '../../shared/constants';

type PermissionState = {
  microphone: 'granted' | 'denied' | 'not-determined';
  accessibility: boolean;
};

const DEFAULT_PERMISSIONS: PermissionState = {
  microphone: 'not-determined',
  accessibility: false,
};

/* ── Preserved components for Task 6 ──────────────────────────── */

function PermissionIcon({ kind }: { kind: 'microphone' | 'accessibility' }) {
  if (kind === 'microphone') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="8" y="3" width="8" height="12" rx="4" />
        <path d="M6 11a6 6 0 0 0 12 0" />
        <path d="M12 17v4" />
        <path d="M8.5 21h7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="5" width="16" height="12" rx="3" />
      <path d="M9 9h6" />
      <path d="M8 13h1" />
      <path d="M11.5 13h1" />
      <path d="M15 13h1" />
      <path d="M9 19h6" />
    </svg>
  );
}

function PermissionCard({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  ready,
  disabled,
}: {
  kind: 'microphone' | 'accessibility';
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  ready: boolean;
  disabled: boolean;
}) {
  return (
    <article
      className={`section-card flex h-full flex-col p-3.5 transition-colors duration-200 ${
        ready ? 'border-[rgba(15,118,110,0.18)] bg-[rgba(245,255,252,0.88)]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={`flex h-9 w-9 flex-none items-center justify-center rounded-2xl border ${
              ready
                ? 'border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.08)] text-[#0f766e]'
                : 'border-[#15231e]/10 bg-white/75 text-[#23312c]'
            }`}
          >
            <PermissionIcon kind={kind} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#16211b]">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-[#4b5650]">{description}</p>
          </div>
        </div>
        <span className={`status-pill flex-none ${ready ? 'status-pill--ready' : 'status-pill--pending'}`}>
          {ready ? 'Ready' : 'Pending'}
        </span>
      </div>

      {!disabled ? (
        <div className="mt-3 flex border-t border-[#15231e]/6 pt-3">
          <Button size="sm" variant="secondary" className="self-start" onClick={onAction} disabled={disabled}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

/* ── Wizard step definitions ──────────────────────────────────── */

type StepId = 'mic' | 'accessibility' | 'stt' | 'done';

const isMac = navigator.platform.includes('Mac');
const STEPS: StepId[] = isMac ? ['mic', 'accessibility', 'stt', 'done'] : ['stt', 'done'];

/* ── Step indicator dots ──────────────────────────────────────── */

function StepIndicator({ steps, currentStep }: { steps: StepId[]; currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {steps.map((stepId, i) => (
        <div
          key={stepId}
          className={`h-2 w-2 rounded-full transition-all duration-300 ${
            i <= currentStep
              ? 'bg-[#15231e] scale-100'
              : 'bg-[#15231e]/15 scale-90'
          }`}
        />
      ))}
    </div>
  );
}

/* ── Main OnboardingView ──────────────────────────────────────── */

export function OnboardingView() {
  const [currentStep, setCurrentStep] = useState(0);
  const [permissions, setPermissions] = useState<PermissionState>(DEFAULT_PERMISSIONS);
  const [isPollingAccessibility, setIsPollingAccessibility] = useState(false);
  const [hasRequestedAccessibilityPrompt, setHasRequestedAccessibilityPrompt] = useState(false);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [provider, setProvider] = useState<'openai' | 'custom'>('openai');

  useEffect(() => {
    void window.api.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (settings) {
      setProvider(settings.apiBaseURL.startsWith('https://api.openai.com') ? 'openai' : 'custom');
    }
  }, [settings]);

  const saveSettings = (updated: AppSettings) => {
    setSettings(updated);
    void window.api.saveSettings(updated);
  };

  const refreshPermissions = useCallback(async () => {
    const latest = await window.api.checkPermissions();
    setPermissions(latest);
    if (latest.accessibility) {
      setIsPollingAccessibility(false);
    }
    return latest;
  }, []);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    if (!isPollingAccessibility) {
      return;
    }

    const interval = setInterval(() => {
      void refreshPermissions();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isPollingAccessibility, refreshPermissions]);

  const requestMicrophoneAccess = async () => {
    await window.api.requestMicrophonePermission();
    await refreshPermissions();
  };

  const openAccessibilitySettings = async () => {
    if (!hasRequestedAccessibilityPrompt) {
      await window.api.requestAccessibility();
      setHasRequestedAccessibilityPrompt(true);
    }
    await window.api.openAccessibilitySettings();
    setIsPollingAccessibility(true);
  };

  const isMicrophoneGranted = permissions.microphone === 'granted';
  const isAccessibilityGranted = permissions.accessibility;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  const stepId = STEPS[currentStep];
  const nextDisabled = (stepId === 'mic' && !isMicrophoneGranted) || (stepId === 'accessibility' && !isAccessibilityGranted);

  return (
    <div className="app-shell app-shell--flush">
      <div className="window-panel window-panel--flush">
        <div className="window-content overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full min-w-0 flex-col px-4 pb-4 pt-3">
            <WindowChrome label="Setup" showMinimize={false} showZoom={false} />

            <header className="border-b border-[#15231e]/6 pb-3 pt-1.5">
              <div className="flex items-center gap-3">
                <img src="icon.png" alt="WhisperApp" className="h-14 w-14 rounded-[14px]" draggable={false} />
                <div className="min-w-0">
                  <h1
                    className="text-[2.75rem] font-bold leading-[0.94] tracking-[-0.05em] text-[#16211b]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    WhisperApp
                  </h1>
                </div>
              </div>
            </header>

            <StepIndicator steps={STEPS} currentStep={currentStep} />

            {/* Step content */}
            <div className="flex-1 py-4">
              <div className="mx-auto max-w-5xl">
                {stepId === 'mic' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#16211b]">Welcome to WhisperApp</h2>
                      <p className="mt-1 text-sm leading-5 text-[#4b5650]">Hold a hotkey to record, release to transcribe — WhisperApp pastes the text into your active app.</p>
                    </div>
                    <PermissionCard kind="microphone" title="Microphone Access" description="Required to capture your voice before transcription starts." actionLabel="Grant" onAction={requestMicrophoneAccess} ready={isMicrophoneGranted} disabled={isMicrophoneGranted} />
                  </div>
                )}
                {stepId === 'accessibility' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm leading-5 text-[#4b5650]">WhisperApp needs Accessibility access so the global hotkey can start recording while you work in any app.</p>
                      <p className="mt-2 text-sm leading-5 text-[#4b5650]">Go to <strong>System Settings → Privacy &amp; Security → Accessibility</strong>, find WhisperApp, and toggle it on.</p>
                    </div>
                    <PermissionCard kind="accessibility" title="Accessibility Access" description="Required so the global hotkey can start recording while you work in any app." actionLabel="Open Settings" onAction={openAccessibilitySettings} ready={isAccessibilityGranted} disabled={isAccessibilityGranted} />
                  </div>
                )}
                {stepId === 'stt' && settings && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#16211b]">Speech to Text Provider</h2>
                      <p className="mt-1 text-sm leading-5 text-[#4b5650]">Choose your transcription backend and configure the connection.</p>
                    </div>

                    <div className="flex gap-2 rounded-full border border-[#15231e]/8 bg-white/70 p-1">
                      <button
                        type="button"
                        onClick={() => { setProvider('openai'); saveSettings({ ...settings, apiBaseURL: DEFAULT_API_BASE_URL }); }}
                        className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${provider === 'openai' ? 'bg-[#15231e] text-white' : 'text-[#4b5650]'}`}
                      >
                        OpenAI
                      </button>
                      <button
                        type="button"
                        onClick={() => setProvider('custom')}
                        className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${provider === 'custom' ? 'bg-[#15231e] text-white' : 'text-[#4b5650]'}`}
                      >
                        Custom Server
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {provider === 'openai' && (
                        <label className="block">
                          <span className="field-label">API Key</span>
                          <input
                            type="password"
                            className="field-control text-sm"
                            placeholder="sk-..."
                            value={settings.apiKey}
                            onChange={(e) => saveSettings({ ...settings, apiKey: e.target.value, apiBaseURL: DEFAULT_API_BASE_URL })}
                          />
                          <span className="field-help">Get your API key at platform.openai.com/api-keys</span>
                        </label>
                      )}
                      {provider === 'custom' && (
                        <>
                          <label className="block">
                            <span className="field-label">Base URL</span>
                            <input
                              type="text"
                              className="field-control text-sm"
                              placeholder="https://your-server.com/v1"
                              value={settings.apiBaseURL}
                              onChange={(e) => saveSettings({ ...settings, apiBaseURL: e.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="field-label">API Key</span>
                            <input
                              type="password"
                              className="field-control text-sm"
                              placeholder="your-api-key"
                              value={settings.apiKey}
                              onChange={(e) => saveSettings({ ...settings, apiKey: e.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="field-label">Model</span>
                            <input
                              type="text"
                              className="field-control text-sm"
                              placeholder="whisper-1"
                              value={settings.modelName}
                              onChange={(e) => saveSettings({ ...settings, modelName: e.target.value })}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {stepId === 'done' && (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(15,118,110,0.08)]">
                      <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#16211b]">You're all set!</h2>
                    <p className="mt-2 max-w-xs text-sm leading-5 text-[#4b5650]">WhisperApp is configured and ready. You can always change these settings later.</p>
                    <Button
                      className="mt-6 w-full max-w-xs"
                      onClick={() => {
                        void window.api.completeOnboarding();
                        void window.api.showSettings();
                        window.close();
                      }}
                    >
                      Open WhisperApp
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation bar */}
            <div className="flex items-center justify-between border-t border-[#15231e]/6 pt-3">
              <div>
                {!isFirstStep && (
                  <Button size="sm" variant="secondary" onClick={() => setCurrentStep((s) => s - 1)}>
                    Back
                  </Button>
                )}
              </div>
              <div>
                {!isLastStep && (
                  <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={nextDisabled}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Keep PermissionCard / PermissionIcon exported for Task 6 ── */
export { PermissionCard, PermissionIcon };

/* ── Keep permission helpers accessible ────────────────────────── */
export type { PermissionState };
