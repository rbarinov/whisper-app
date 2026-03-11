import React, { useState, useEffect } from 'react';

type OverlayDisplayState =
  | { type: 'hidden' }
  | { type: 'recording' }
  | { type: 'transcribing' }
  | { type: 'processing' }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string }
  | { type: 'cancelled' };

/** Spinner SVG for transcribing/processing states */
function Spinner({ color }: { color: string }) {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke={color} strokeWidth="4" />
      <path
        className="opacity-75"
        fill={color}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/** Floating overlay view showing recording/transcription status */
export function OverlayView() {
  const [state, setState] = useState<OverlayDisplayState>({ type: 'hidden' });

  useEffect(() => {
    const unsubscribe = window.api.onOverlayUpdate((rawState: unknown) => {
      setState(rawState as OverlayDisplayState);
    });
    return unsubscribe;
  }, []);

  if (state.type === 'hidden') return null;

  const borderColors: Record<string, string> = {
    recording: 'border-recording',
    transcribing: 'border-transcribing',
    processing: 'border-processing',
    done: 'border-idle',
    error: 'border-error',
    cancelled: 'border-cancelled',
  };

  const border = borderColors[state.type] ?? 'border-gray-600';

  return (
    <div
      className={`
        fixed bottom-8 left-1/2 -translate-x-1/2
        bg-black/75 text-white
        rounded-2xl px-5 py-3
        border ${border}
        flex items-center gap-3
        max-w-xs w-auto
        shadow-2xl
      `}
      style={{ minWidth: 180 }}
    >
      {state.type === 'recording' && (
        <>
          <span className="w-3 h-3 rounded-full bg-recording animate-pulse" />
          <span className="text-sm font-medium">Recording...</span>
        </>
      )}
      {state.type === 'transcribing' && (
        <>
          <Spinner color="#3b82f6" />
          <span className="text-sm font-medium text-transcribing">Transcribing...</span>
        </>
      )}
      {state.type === 'processing' && (
        <>
          <Spinner color="#8b5cf6" />
          <span className="text-sm font-medium text-processing">Processing...</span>
        </>
      )}
      {state.type === 'done' && (
        <>
          <span className="text-idle text-lg">✓</span>
          <span className="text-sm text-gray-200 line-clamp-2">{state.text || 'Done'}</span>
        </>
      )}
      {state.type === 'error' && (
        <>
          <span className="text-error text-lg">⚠</span>
          <span className="text-sm text-gray-200 truncate">{state.message || 'Error'}</span>
        </>
      )}
      {state.type === 'cancelled' && (
        <>
          <span className="text-cancelled text-lg">✕</span>
          <span className="text-sm text-gray-400">Cancelled</span>
        </>
      )}
    </div>
  );
}
