import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { LegalNotice } from '../components/LegalNotice';
import { WindowChrome } from '../components/WindowChrome';

type PermissionState = {
  microphone: 'granted' | 'denied' | 'not-determined';
  accessibility: boolean;
};

const DEFAULT_PERMISSIONS: PermissionState = {
  microphone: 'not-determined',
  accessibility: false,
};

function BrandMark() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center rounded-[20px] border border-[#15231e]/10 bg-[#15231e] text-white shadow-[0_18px_32px_rgba(21,35,30,0.16)]">
      <div className="absolute inset-2 rounded-[16px] border border-white/10" />
      <div className="relative flex h-7 w-[18px] items-start justify-center rounded-full border border-white/70">
        <div className="mt-1 h-3.5 w-2 rounded-full bg-white/85" />
      </div>
      <div className="absolute bottom-3.5 h-2 w-5 rounded-full bg-white/14" />
    </div>
  );
}

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

export function OnboardingView() {
  const [permissions, setPermissions] = useState<PermissionState>(DEFAULT_PERMISSIONS);
  const [isPollingAccessibility, setIsPollingAccessibility] = useState(false);
  const [hasRequestedAccessibilityPrompt, setHasRequestedAccessibilityPrompt] = useState(false);

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
  const allGranted = isMicrophoneGranted && isAccessibilityGranted;

  const continueText = useMemo(() => {
    return allGranted ? 'Open WhisperApp' : 'Waiting for permissions...';
  }, [allGranted]);

  return (
    <div className="app-shell app-shell--flush">
      <div className="window-panel window-panel--flush">
        <div className="window-content overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full min-w-0 flex-col px-4 pb-4 pt-3">
            <WindowChrome label="Setup" showMinimize={false} showZoom={false} />

            <header className="border-b border-[#15231e]/6 pb-3 pt-1.5">
              <div className="flex items-start gap-3">
                <BrandMark />
                <div className="min-w-0">
                  <h1 className="text-[2.75rem] font-[650] leading-[0.94] tracking-[-0.05em] text-[#16211b]">
                    WhisperApp
                  </h1>
                </div>
              </div>
            </header>

            <div className="flex-1 py-4">
              <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2">
                <PermissionCard
                  kind="microphone"
                  title="Microphone Access"
                  description="Required to capture your voice before transcription starts."
                  actionLabel="Grant"
                  onAction={requestMicrophoneAccess}
                  ready={isMicrophoneGranted}
                  disabled={isMicrophoneGranted}
                />

                <PermissionCard
                  kind="accessibility"
                  title="Accessibility Access"
                  description="Required so the global hotkey can start recording while you work in any app."
                  actionLabel="Open Settings"
                  onAction={openAccessibilitySettings}
                  ready={isAccessibilityGranted}
                  disabled={isAccessibilityGranted}
                />
              </div>

              <section className="section-card mx-auto mt-3 max-w-5xl px-4 py-3.5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="hero-kicker">Workflow</p>
                    <p className="mt-1.5 text-sm leading-5 text-[#4b5650]">
                      Hold F5 to record, release to transcribe, then WhisperApp pastes the final text back into your active app.
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    <Button
                      onClick={() => {
                        if (allGranted) {
                          window.close();
                        }
                      }}
                      disabled={!allGranted}
                      className="min-w-[180px]"
                    >
                      {continueText}
                    </Button>
                  </div>
                </div>
              </section>

              <LegalNotice className="mx-auto mt-3 max-w-5xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
