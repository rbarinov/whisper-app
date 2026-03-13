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
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke={color} strokeWidth="3" />
      <path
        className="opacity-85"
        fill={color}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function Waveform({ color }: { color: string }) {
  return (
    <div className="overlay-wave" style={{ color }} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className="overlay-wave__bar"
          style={{
            animationDelay: `${index * 0.12}s`,
            height: `${10 + (index % 2 === 0 ? 8 : 14)}px`,
          }}
        />
      ))}
    </div>
  );
}

function DoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 13.5 9.5 18 19 7" />
    </svg>
  );
}

function ErrorGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
      <path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function CancelledGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
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

  const accentColors: Record<Exclude<OverlayDisplayState['type'], 'hidden'>, string> = {
    recording: '#e85d50',
    transcribing: '#4675d8',
    processing: '#c38b36',
    done: '#169976',
    error: '#d97745',
    cancelled: '#b0b5b2',
  };

  const accent = accentColors[state.type];

  const heading =
    state.type === 'recording' ? 'Recording...' :
    state.type === 'transcribing' ? 'Transcribing...' :
    state.type === 'processing' ? 'Processing...' :
    state.type === 'done' ? state.text || 'Done' :
    state.type === 'error' ? state.message || 'Error' :
    'Cancelled';

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={`overlay-shell overlay-shell--${state.type}`}>
        <div className="relative z-[1] flex h-full items-center gap-3 px-3">
          <div className="overlay-icon-slot shrink-0" style={{ color: accent }}>
            {state.type === 'recording' ? (
              <Waveform color={accent} />
            ) : (
              <div className="overlay-orb" style={{ color: accent }}>
                {state.type === 'transcribing' && <Spinner color={accent} />}
                {state.type === 'processing' && <Spinner color={accent} />}
                {state.type === 'done' && <DoneGlyph />}
                {state.type === 'error' && <ErrorGlyph />}
                {state.type === 'cancelled' && <CancelledGlyph />}
              </div>
            )}
          </div>

          <p
            className={`min-w-0 flex-1 truncate text-[12px] font-medium leading-none ${
              state.type === 'cancelled' ? 'text-white/90' : 'text-white'
            }`}
          >
            {heading}
          </p>
        </div>
      </div>
    </div>
  );
}
