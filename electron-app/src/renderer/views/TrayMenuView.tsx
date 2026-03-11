import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import type { TranscriptionEntry } from '../../shared/types';

interface AppStateData {
  recordingState: string;
  history: TranscriptionEntry[];
  isMicrophoneGranted: boolean;
}

const stateLabels: Record<string, string> = {
  idle: 'Ready',
  recording: 'Recording...',
  transcribing: 'Transcribing...',
  processing: 'Processing...',
};

/** Tray menu dropdown view shown as small BrowserWindow near system tray */
export function TrayMenuView() {
  const [appState, setAppState] = useState<AppStateData>({
    recordingState: 'idle',
    history: [],
    isMicrophoneGranted: true,
  });
  const [waylandMsg, setWaylandMsg] = useState<string | null>(null);

  useEffect(() => {
    window.api.getAppState().then((state) => {
      if (state) setAppState(state as AppStateData);
    });

    const unsubState = window.api.onStateUpdate((state) => {
      setAppState(state as AppStateData);
    });
    const unsubWayland = window.api.onWaylandNotify((msg) => {
      setWaylandMsg(msg);
      setTimeout(() => setWaylandMsg(null), 5000);
    });

    return () => {
      unsubState();
      unsubWayland();
    };
  }, []);

  const { recordingState, history } = appState;
  const isRecording = recordingState === 'recording';
  const isBusy = ['recording', 'transcribing', 'processing'].includes(recordingState);
  const lastEntry = history[0];

  const statusType =
    recordingState === 'idle' ? 'idle' :
    recordingState === 'recording' ? 'recording' :
    recordingState === 'transcribing' ? 'transcribing' :
    recordingState === 'processing' ? 'processing' :
    recordingState === 'error' ? 'error' : 'idle';

  return (
    <div className="w-[17.5rem] overflow-hidden rounded-[22px] border border-[#15231e]/10 bg-[#f7f4ee] text-[#16211b] shadow-[0_20px_48px_rgba(21,35,30,0.18)]">
      <div className="border-b border-[#15231e]/8 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusBadge status={statusType} size="sm" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b746f]">WhisperApp</p>
              <p className="truncate text-sm font-semibold text-[#16211b]">
                {stateLabels[recordingState] ?? recordingState}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[#15231e]/8 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b746f]">
            F5
          </span>
        </div>
      </div>

      {waylandMsg && (
        <div className="border-b border-[#15231e]/8 bg-[rgba(195,139,54,0.1)] px-4 py-2 text-xs text-[#8d6021]">
          {waylandMsg}
        </div>
      )}

      <div className="px-4 py-3">
        {isBusy && !isRecording ? (
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={() => window.api.cancelRecording()}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant={isRecording ? 'danger' : 'primary'}
            size="sm"
            className="w-full"
            onClick={() =>
              isRecording ? window.api.stopRecording() : window.api.startRecording()
            }
          >
            {isRecording ? 'Stop Recording' : 'Start Recording (F5)'}
          </Button>
        )}
      </div>

      {lastEntry && lastEntry.status === 'successful' && lastEntry.text && (
        <div className="border-b border-[#15231e]/8 px-4 pb-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b746f]">Last transcription</p>
          <p className="line-clamp-3 text-xs leading-5 text-[#4b5650]">{lastEntry.text}</p>
          <button
            className="mt-1.5 text-xs font-semibold text-[#115e59] hover:underline"
            onClick={() => lastEntry.text && window.api.copyToClipboard(lastEntry.text)}
          >
            Copy
          </button>
        </div>
      )}

      <div className="grid gap-px bg-[#15231e]/8">
        <button
          className="bg-white/72 px-4 py-2.5 text-left text-sm font-medium text-[#16211b] transition-colors hover:bg-white"
          onClick={() => window.api.showHistory()}
        >
          History
        </button>
        <button
          className="bg-white/72 px-4 py-2.5 text-left text-sm font-medium text-[#16211b] transition-colors hover:bg-white"
          onClick={() => window.api.showSettings()}
        >
          Settings
        </button>
        <button
          className="bg-white/72 px-4 py-2.5 text-left text-sm font-medium text-[#16211b] transition-colors hover:bg-white"
          onClick={() => window.api.showOnboarding()}
        >
          Onboarding
        </button>
        <button
          className="bg-white/72 px-4 py-2.5 text-left text-sm font-medium text-[#b45347] transition-colors hover:bg-white"
          onClick={() => window.api.quit()}
        >
          Quit
        </button>
      </div>
    </div>
  );
}
