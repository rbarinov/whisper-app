import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';

type PermissionState = {
  microphone: 'granted' | 'denied' | 'not-determined';
  accessibility: boolean;
};

const DEFAULT_PERMISSIONS: PermissionState = {
  microphone: 'not-determined',
  accessibility: false,
};

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
    return allGranted ? 'Get Started' : 'Waiting for permissions...';
  }, [allGranted]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[460px] rounded-2xl bg-white shadow-xl border border-gray-100 p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎤</div>
          <h1 className="text-2xl font-semibold text-gray-900">WhisperApp</h1>
          <p className="text-sm text-gray-500 mt-1">Speech to text, everywhere</p>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl">🎙️</span>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Microphone Access</h2>
                  <p className="text-xs text-gray-500 mt-1">Required to record your voice for transcription</p>
                </div>
              </div>
              <span className={`text-sm ${isMicrophoneGranted ? 'text-green-600' : 'text-yellow-600'}`}>
                {isMicrophoneGranted ? '✅' : '⚠️'}
              </span>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={requestMicrophoneAccess}
                disabled={isMicrophoneGranted}
              >
                Grant Access
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl">⌨️</span>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Accessibility Access</h2>
                  <p className="text-xs text-gray-500 mt-1">Required for global hotkey (F5) to work anywhere</p>
                </div>
              </div>
              <span className={`text-sm ${isAccessibilityGranted ? 'text-green-600' : 'text-yellow-600'}`}>
                {isAccessibilityGranted ? '✅' : '⚠️'}
              </span>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={openAccessibilitySettings}
                disabled={isAccessibilityGranted}
              >
                Open Settings
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
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
    </div>
  );
}
