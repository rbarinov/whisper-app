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
    <div className="bg-gray-900 text-white w-64 rounded-lg shadow-2xl overflow-hidden">
      {/* Status row */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
        <StatusBadge status={statusType} size="sm" />
        <span className="text-sm font-medium">
          {stateLabels[recordingState] ?? recordingState}
        </span>
      </div>

      {/* Wayland notification */}
      {waylandMsg && (
        <div className="px-4 py-2 text-xs text-yellow-300 bg-yellow-900/30">
          {waylandMsg}
        </div>
      )}

      {/* Record button */}
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

      {/* Last transcription */}
      {lastEntry && lastEntry.status === 'successful' && lastEntry.text && (
        <div className="px-4 pb-3 border-b border-gray-700">
          <p className="text-xs text-gray-400 mb-1">Last transcription</p>
          <p className="text-xs text-gray-200 line-clamp-3">{lastEntry.text}</p>
          <button
            className="mt-1 text-xs text-blue-400 hover:underline"
            onClick={() => lastEntry.text && window.api.copyToClipboard(lastEntry.text)}
          >
            Copy
          </button>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex flex-col">
        <button
          className="px-4 py-2 text-left text-sm hover:bg-gray-800 transition-colors"
          onClick={() => window.api.showHistory()}
        >
          History
        </button>
        <button
          className="px-4 py-2 text-left text-sm hover:bg-gray-800 transition-colors"
          onClick={() => window.api.showSettings()}
        >
          Settings
        </button>
        <button
          className="px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-800 transition-colors"
          onClick={() => window.api.quit()}
        >
          Quit
        </button>
      </div>
    </div>
  );
}
