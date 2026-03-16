import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { WindowChrome } from '../components/WindowChrome';
import type { TranscriptionEntry } from '../../shared/types';

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMins = Math.floor(diffSeconds / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="section-card min-w-[7rem] px-3 py-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b746f]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#16211b]">{value}</p>
    </div>
  );
}

function HistoryRow({
  entry,
  playingEntryId,
  onPlay,
  onStop,
  onCopy,
  onDelete,
  onRetry,
}: {
  entry: TranscriptionEntry;
  playingEntryId: string | null;
  onPlay: (id: string, path: string) => void;
  onStop: () => void;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isPlaying = playingEntryId === entry.id;
  const hasAudio = !!entry.audioFilePath;
  const hasProcessedVariant =
    entry.status === 'successful' &&
    Boolean(entry.text) &&
    Boolean(entry.rawText) &&
    entry.text?.trim() !== entry.rawText?.trim();

  const handleCopy = (text: string) => {
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const statusPillClass =
    entry.status === 'successful' ? 'status-pill status-pill--ready' :
    entry.status === 'failed' ? 'status-pill status-pill--pending' :
    entry.status === 'cancelled' ? 'status-pill status-pill--muted' :
    entry.status === 'recording' || entry.status === 'processing' || entry.status === 'transcribing' ? 'status-pill status-pill--live' :
    'status-pill status-pill--pending';

  return (
    <article className={`history-entry ${entry.status === 'recording' || entry.status === 'transcribing' || entry.status === 'processing' ? 'history-entry--live' : ''}`}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={statusPillClass}>
                {entry.status === 'successful'
                  ? 'Ready'
                  : entry.status === 'failed'
                    ? 'Retry needed'
                    : entry.status === 'cancelled'
                      ? 'Cancelled'
                      : entry.status === 'recording'
                        ? 'Recording'
                        : entry.status === 'processing'
                          ? 'Processing'
                          : 'Transcribing'}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b746f]">
                {formatRelativeTime(new Date(entry.timestamp).getTime())}
              </span>
              <span className="text-[13px] text-[#6b746f]">
                {entry.durationSeconds ? `${entry.durationSeconds.toFixed(1)}s` : 'Short note'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasAudio && (
              <button
                type="button"
                className="action-chip"
                onClick={() =>
                  isPlaying
                    ? onStop()
                    : entry.audioFilePath && onPlay(entry.id, entry.audioFilePath)
                }
              >
                {isPlaying ? 'Stop' : 'Play'}
              </button>
            )}
            {(entry.status === 'failed' || entry.status === 'cancelled') && hasAudio && (
              <button
                type="button"
                className="action-chip action-chip--accent"
                onClick={() => onRetry(entry.id)}
              >
                Retry
              </button>
            )}
            {(entry.status === 'successful' || ((entry.status === 'cancelled' || entry.status === 'failed') && entry.rawText)) && (
              <button
                type="button"
                className="action-chip action-chip--accent"
                onClick={() => handleCopy(entry.text ?? entry.rawText ?? '')}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            <button
              type="button"
              className="action-chip action-chip--danger"
              onClick={() => onDelete(entry.id)}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="border-t border-[#15231e]/6 pt-3">
          {entry.status === 'recording' && (
            <p className="text-sm font-medium text-[#4675d8]">Recording...</p>
          )}
          {entry.status === 'transcribing' && (
            <p className="text-sm font-medium text-[#4675d8]">Transcribing...</p>
          )}
          {entry.status === 'processing' && (
            <p className="text-sm font-medium text-[#4675d8]">Processing with LLM...</p>
          )}
          {entry.status === 'successful' && entry.text && (
            <div className="space-y-2.5">
              {entry.errorMessage && (
                <p className="mb-3 rounded-[16px] bg-[rgba(217,119,69,0.08)] px-3 py-2 text-sm text-[#b46f48]">
                  Partial issue: {entry.errorMessage}
                </p>
              )}
              <div>
                {hasProcessedVariant ? (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b746f]">Final</p>
                ) : null}
                <p className="clamp-3 text-[14px] leading-6 text-[#1c2924]">{entry.text}</p>
              </div>
              {hasProcessedVariant ? (
                <div className="rounded-[14px] border border-[#15231e]/8 bg-white/60 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b746f]">
                    Original
                  </p>
                  <p className="mt-1.5 clamp-3 text-[13px] leading-5 text-[#5f6964]">{entry.rawText}</p>
                </div>
              ) : null}
            </div>
          )}
          {entry.status === 'failed' && (
            <div className="space-y-2">
              <p className="text-sm leading-6 text-[#b45347]">
                Transcription failed{entry.errorMessage ? `: ${entry.errorMessage}` : ''}
              </p>
              {entry.rawText && (
                <div className="rounded-[14px] border border-[#15231e]/8 bg-white/60 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b746f]">Transcription</p>
                  <p className="mt-1.5 clamp-3 text-[13px] leading-5 text-[#5f6964]">{entry.rawText}</p>
                </div>
              )}
            </div>
          )}
          {entry.status === 'cancelled' && (
            <div className="space-y-2">
              <p className="text-sm leading-6 text-[#6b746f]">Recording cancelled</p>
              {entry.rawText && (
                <div className="rounded-[14px] border border-[#15231e]/8 bg-white/60 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b746f]">Transcription</p>
                  <p className="mt-1.5 clamp-3 text-[13px] leading-5 text-[#5f6964]">{entry.rawText}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/** History window — scrollable list of all transcription entries */
export function HistoryView() {
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [playingEntryId, setPlayingEntryId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = useCallback(async (syncMain = true) => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    }

    setPlayingEntryId(null);
    if (syncMain) {
      await window.api.stopAudio();
    }
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleEnded = () => {
      void stopPlayback(true);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleEnded);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, [stopPlayback]);

  useEffect(() => {
    void window.api.getHistory().then((h) => setHistory(h));
    void window.api.getAppState().then((state) => {
      const appState = state as { isAudioPlaying?: boolean; playingEntryId?: string | null };
      if (appState.isAudioPlaying) {
        setPlayingEntryId(appState.playingEntryId ?? null);
      }
    });

    const unsubscribe = window.api.onStateUpdate((state: unknown) => {
      const s = state as {
        history?: TranscriptionEntry[];
        isAudioPlaying?: boolean;
        playingEntryId?: string | null;
      };
      if (s.history) setHistory(s.history);
      if (typeof s.isAudioPlaying === 'boolean') {
        setPlayingEntryId(s.isAudioPlaying ? s.playingEntryId ?? null : null);
        if (!s.isAudioPlaying && audioRef.current && !audioRef.current.paused) {
          void stopPlayback(false);
        }
      }
    });

    return unsubscribe;
  }, [stopPlayback]);

  const handlePlay = useCallback(async (id: string, path: string) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    try {
      const resolvedPath = await window.api.getAudioPath(path);
      audio.pause();
      audio.currentTime = 0;
      audio.src = encodeURI(`file://${resolvedPath}`);
      setPlayingEntryId(id);
      await audio.play();
      await window.api.playAudio(id, resolvedPath);
    } catch (error) {
      console.error('Failed to play audio:', error);
      await stopPlayback(true);
    }
  }, [stopPlayback]);

  const handleStop = useCallback(() => {
    void stopPlayback(true);
  }, [stopPlayback]);
  const handleCopy = (text: string) => window.api.copyToClipboard(text);
  const handleDelete = async (id: string) => {
    if (playingEntryId === id) {
      await stopPlayback(true);
    }
    await window.api.deleteEntry(id);
    setHistory((h) => h.filter((e) => e.id !== id));
  };
  const handleRetry = (id: string) => window.api.retryTranscription(id);
  const handleClearAll = async () => {
    await stopPlayback(true);
    await window.api.clearHistory();
    setHistory([]);
  };

  const recordingsWithAudio = history.filter((entry) => Boolean(entry.audioFilePath)).length;
  const latestEntryAge = history[0] ? formatRelativeTime(new Date(history[0].timestamp).getTime()) : 'No entries';

  return (
    <div className="app-shell app-shell--flush">
      <div className="window-panel window-panel--flush">
        <div className="window-content">
            <div className="px-4 pt-3">
              <WindowChrome label="History" />
            </div>

            <header className="border-b border-[#15231e]/6 px-4 pb-3 pt-1.5">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="view-title text-[2.25rem]">History</h1>
                  <button
                    type="button"
                    onClick={() => void window.api.showSettings()}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#15231e]/40 transition-colors hover:bg-[#15231e]/6 hover:text-[#15231e]"
                    title="Settings"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                    </svg>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:max-w-[36rem] lg:justify-end">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <HistoryMetric label="Latest" value={latestEntryAge} />
                    <HistoryMetric label="Audio" value={String(recordingsWithAudio)} />
                  </div>
                  {history.length > 0 && (
                    <Button size="sm" variant="danger" className="shrink-0" onClick={handleClearAll}>
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
              {history.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="section-card flex max-w-md flex-col items-center px-6 py-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#15231e]/10 bg-[#15231e] text-white shadow-[0_20px_36px_rgba(21,35,30,0.16)]">
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <rect x="8" y="3" width="8" height="12" rx="4" />
                        <path d="M6 11a6 6 0 0 0 12 0" />
                        <path d="M12 17v4" />
                      </svg>
                    </div>
                    <p className="mt-4 text-lg font-semibold tracking-[-0.02em] text-[#16211b]">No transcriptions yet</p>
                    <p className="mt-1.5 text-sm leading-6 text-[#6b746f]">Hold F5 to record</p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex max-w-5xl flex-col gap-2.5">
                  {history.map((entry) => (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      playingEntryId={playingEntryId}
                      onPlay={handlePlay}
                      onStop={handleStop}
                      onCopy={handleCopy}
                      onDelete={handleDelete}
                      onRetry={handleRetry}
                    />
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
