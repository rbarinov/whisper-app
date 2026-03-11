import { useEffect, useRef } from 'react';
import './styles/globals.css';
import { OverlayView } from './views/OverlayView';
import { TrayMenuView } from './views/TrayMenuView';
import { SettingsView } from './views/SettingsView';
import { HistoryView } from './views/HistoryView';
import { OnboardingView } from './views/OnboardingView';
import { AudioRecorderRenderer } from './audio-recorder-renderer';

/**
 * Root React component.
 * Routes to the correct view based on URL query param `?view=...`
 * Each Electron BrowserWindow loads the same HTML bundle with different query params.
 */
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const recorderRef = useRef<AudioRecorderRenderer | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    recorderRef.current = new AudioRecorderRenderer();

    const unsubscribe = window.api.onStateUpdate(async (state: unknown) => {
      const nextState = (state as { recordingState?: { type?: string } })?.recordingState?.type;
      const recorder = recorderRef.current;

      if (!recorder) {
        return;
      }

      if (nextState === 'recording' && !recordingRef.current) {
        try {
          await recorder.startRecording();
          recordingRef.current = true;
        } catch {
          recordingRef.current = false;
        }
        return;
      }

      const shouldStop = nextState === 'transcribing' || nextState === 'idle' || nextState === 'error';
      if (shouldStop && recordingRef.current) {
        const samples = recorder.stopRecording();
        recordingRef.current = false;
        window.api.sendRecordingData(Array.from(samples), recorder.getSampleRate());
      }
    });

    return () => {
      if (recordingRef.current && recorderRef.current) {
        recorderRef.current.stopRecording();
        recordingRef.current = false;
      }
      unsubscribe();
      recorderRef.current = null;
    };
  }, []);

  switch (view) {
    case 'overlay':
      return <OverlayView />;
    case 'tray-menu':
      return <TrayMenuView />;
    case 'history':
      return <HistoryView />;
    case 'settings':
      return <SettingsView />;
    case 'onboarding':
      return <OnboardingView />;
    default:
      return <SettingsView />;
  }
}
