import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
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

  const handleCopy = (text: string) => {
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const statusBadgeType =
    entry.status === 'successful' ? 'idle' :
    entry.status === 'failed' ? 'error' :
    entry.status === 'cancelled' ? 'cancelled' :
    entry.status === 'transcribing' ? 'transcribing' : 'idle';

  return (
    <div className="border-b border-gray-100 py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={statusBadgeType} size="sm" />
          <span className="text-xs text-gray-400">
            {formatRelativeTime(new Date(entry.timestamp).getTime())}
            {entry.durationSeconds ? ` \u00b7 ${entry.durationSeconds.toFixed(1)}s` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasAudio && (
            <button
              className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200"
              onClick={() =>
                isPlaying
                  ? onStop()
                  : entry.audioFilePath && onPlay(entry.id, entry.audioFilePath)
              }
            >
              {isPlaying ? '⏹ Stop' : '▶ Play'}
            </button>
          )}
          {(entry.status === 'failed' || entry.status === 'cancelled') && hasAudio && (
            <button
              className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
              onClick={() => onRetry(entry.id)}
            >
              Retry
            </button>
          )}
          <button
            className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100"
            onClick={() => onDelete(entry.id)}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Content by status */}
      {entry.status === 'transcribing' && (
        <p className="mt-1 text-xs text-blue-500 animate-pulse">Transcribing...</p>
      )}
      {entry.status === 'successful' && entry.text && (
        <div className="mt-1">
          {entry.errorMessage && (
            <p className="text-xs text-orange-500 mb-1">⚠ {entry.errorMessage}</p>
          )}
          <p className="text-sm text-gray-800 line-clamp-4">{entry.text}</p>
          <button
            className="mt-1 text-xs text-blue-500 hover:underline"
            onClick={() => entry.text && handleCopy(entry.text)}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}
      {entry.status === 'failed' && (
        <p className="mt-1 text-xs text-red-500">
          Transcription failed{entry.errorMessage ? `: ${entry.errorMessage}` : ''}
        </p>
      )}
      {entry.status === 'cancelled' && (
        <p className="mt-1 text-xs text-gray-400">Recording cancelled</p>
      )}
    </div>
  );
}

/** History window — scrollable list of all transcription entries */
export function HistoryView() {
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [playingEntryId, setPlayingEntryId] = useState<string | null>(null);

  useEffect(() => {
    window.api.getHistory().then((h) => setHistory(h));
    const unsubscribe = window.api.onStateUpdate((state: unknown) => {
      const s = state as { history?: TranscriptionEntry[] };
      if (s.history) setHistory(s.history);
    });
    return unsubscribe;
  }, []);

  const handlePlay = (id: string, path: string) => {
    setPlayingEntryId(id);
    window.api.playAudio(id, path);
  };
  const handleStop = () => {
    setPlayingEntryId(null);
    window.api.stopAudio();
  };
  const handleCopy = (text: string) => window.api.copyToClipboard(text);
  const handleDelete = async (id: string) => {
    await window.api.deleteEntry(id);
    setHistory((h) => h.filter((e) => e.id !== id));
  };
  const handleRetry = (id: string) => window.api.retryTranscription(id);
  const handleClearAll = async () => {
    await window.api.clearHistory();
    setHistory([]);
    setPlayingEntryId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h1 className="text-base font-semibold">History</h1>
        {history.length > 0 && (
          <Button size="sm" variant="danger" onClick={handleClearAll}>
            Clear All
          </Button>
        )}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <span className="text-3xl">🎤</span>
            <p className="text-sm">No transcriptions yet</p>
            <p className="text-xs">Hold F5 to record</p>
          </div>
        ) : (
          history.map((entry) => (
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
          ))
        )}
      </div>
    </div>
  );
}
