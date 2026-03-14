import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import type { TranscriptionEntry } from '../../src/shared/types';

// Mock electron module before importing history-service
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => tempDir),
  },
}));

// Now import the service after mocking electron
import {
  loadHistory,
  saveHistory,
  addEntry,
  updateEntry,
  deleteEntry,
  clearAllHistory,
  getRecordingsDir,
  recoverInterruptedEntries,
} from '../../src/main/services/history-service';
import { app } from 'electron';

let tempDir: string;

describe('history-service', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-history-'));
    vi.mocked(app.getPath).mockReturnValue(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('loadHistory', () => {
    it('returns empty array when history file does not exist', () => {
      const result = loadHistory();
      expect(result).toEqual([]);
    });

    it('loads and parses history from disk', () => {
      const entries: TranscriptionEntry[] = [
        {
          id: 'entry-1',
          timestamp: '2026-03-11T10:00:00Z',
          durationSeconds: 5,
          status: 'successful',
          text: 'Hello world',
          audioFilePath: 'entry-1.wav',
        },
      ];

      const historyPath = path.join(tempDir, 'history.json');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, JSON.stringify(entries), 'utf-8');

      const result = loadHistory();
      expect(result).toEqual(entries);
    });

    it('handles backward-compatible decoding: missing status defaults to successful', () => {
      const entries = [
        {
          id: 'entry-1',
          timestamp: '2026-03-11T10:00:00Z',
          durationSeconds: 5,
          text: 'Hello',
        },
      ];

      const historyPath = path.join(tempDir, 'history.json');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, JSON.stringify(entries), 'utf-8');

      const result = loadHistory();
      expect(result[0].status).toBe('successful');
    });

    it('loadHistory returns in-progress entries as-is (no crash recovery)', () => {
      const entries: TranscriptionEntry[] = [
        {
          id: 'entry-1',
          timestamp: '2026-03-11T10:00:00Z',
          durationSeconds: 5,
          status: 'transcribing',
        },
        {
          id: 'entry-2',
          timestamp: '2026-03-11T10:01:00Z',
          durationSeconds: 0,
          status: 'recording',
        },
      ];

      const historyPath = path.join(tempDir, 'history.json');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, JSON.stringify(entries), 'utf-8');

      const result = loadHistory();
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('transcribing');
      expect(result[1].status).toBe('recording');
    });

    it('returns empty array on JSON parse error', () => {
      const historyPath = path.join(tempDir, 'history.json');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, 'invalid json {]', 'utf-8');

      const result = loadHistory();
      expect(result).toEqual([]);
    });
  });

  describe('saveHistory', () => {
    it('creates history file when it does not exist', () => {
      const entry: TranscriptionEntry = {
        id: 'entry-1',
        timestamp: '2026-03-11T10:00:00Z',
        durationSeconds: 5,
        status: 'successful',
        text: 'Test',
      };

      saveHistory([entry]);

      const historyPath = path.join(tempDir, 'history.json');
      expect(fs.existsSync(historyPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      expect(content).toEqual([entry]);
    });

    it('enforces HISTORY_MAX_ENTRIES limit and deletes audio files for trimmed entries', () => {
      const entries: TranscriptionEntry[] = [];
      for (let i = 0; i < 105; i++) {
        entries.push({
          id: `entry-${i}`,
          timestamp: `2026-03-11T10:${String(i).padStart(2, '0')}:00Z`,
          durationSeconds: 1,
          status: 'successful',
          audioFilePath: `entry-${i}.wav`,
        });
      }

      const recordingsDir = path.join(tempDir, 'recordings');
      fs.mkdirSync(recordingsDir, { recursive: true });
      for (let i = 100; i < 105; i++) {
        fs.writeFileSync(path.join(recordingsDir, `entry-${i}.wav`), 'fake audio');
      }

      saveHistory(entries);

      const historyPath = path.join(tempDir, 'history.json');
      const saved = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      expect(saved).toHaveLength(100);
      expect(saved[0].id).toBe('entry-0');
      expect(saved[99].id).toBe('entry-99');

      for (let i = 100; i < 105; i++) {
        expect(fs.existsSync(path.join(recordingsDir, `entry-${i}.wav`))).toBe(false);
      }
    });

    it('uses atomic write (temp -> rename)', () => {
      const entry: TranscriptionEntry = {
        id: 'entry-1',
        timestamp: '2026-03-11T10:00:00Z',
        durationSeconds: 5,
        status: 'successful',
      };

      saveHistory([entry]);

      const historyPath = path.join(tempDir, 'history.json');
      const tempPath = `${historyPath}.tmp`;
      expect(fs.existsSync(historyPath)).toBe(true);
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });

  describe('addEntry', () => {
    it('adds entry to history and saves', () => {
      const entry: Partial<TranscriptionEntry> = {
        text: 'New entry',
        status: 'successful',
      };

      addEntry(entry);

      const loaded = loadHistory();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].text).toBe('New entry');
      expect(loaded[0].id).toBeDefined();
      expect(loaded[0].timestamp).toBeDefined();
    });

    it('generates UUID if not provided', () => {
      addEntry({ text: 'Test' });
      const loaded = loadHistory();
      expect(loaded[0].id).toBeDefined();
      expect(loaded[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('generates timestamp if not provided', () => {
      const beforeTime = new Date().toISOString();
      addEntry({ text: 'Test' });
      const afterTime = new Date().toISOString();

      const loaded = loadHistory();
      expect(loaded[0].timestamp).toBeDefined();
      const timestamp = loaded[0].timestamp!;
      expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(new Date(timestamp).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });

    it('defaults status to successful if not provided', () => {
      addEntry({ text: 'Test' });
      const loaded = loadHistory();
      expect(loaded[0].status).toBe('successful');
    });

    it('enforces HISTORY_MAX_ENTRIES limit on add', () => {
      for (let i = 0; i < 105; i++) {
        addEntry({ text: `Entry ${i}`, audioFilePath: `file-${i}.wav` });
      }

      const loaded = loadHistory();
      expect(loaded).toHaveLength(100);
      expect(loaded[0].text).toBe('Entry 104');
    });
  });

  describe('updateEntry', () => {
    it('updates an existing entry by id', () => {
      addEntry({ id: 'entry-1', text: 'Original' });
      updateEntry('entry-1', { text: 'Updated' });

      const loaded = loadHistory();
      expect(loaded[0].text).toBe('Updated');
      expect(loaded[0].id).toBe('entry-1');
    });

    it('throws error if entry not found', () => {
      expect(() => updateEntry('nonexistent', { text: 'Test' })).toThrow('Entry not found');
    });

    it('preserves id and timestamp', () => {
      const originalTimestamp = '2026-03-11T10:00:00Z';
      addEntry({ id: 'entry-1', timestamp: originalTimestamp, text: 'Original' });

      updateEntry('entry-1', { text: 'Updated', timestamp: '2099-01-01T00:00:00Z' });

      const loaded = loadHistory();
      expect(loaded[0].id).toBe('entry-1');
      expect(loaded[0].timestamp).toBe(originalTimestamp);
    });
  });

  describe('deleteEntry', () => {
    it('removes entry from history and saves', () => {
      addEntry({ id: 'entry-1', text: 'To delete' });
      expect(loadHistory()).toHaveLength(1);

      deleteEntry('entry-1');

      expect(loadHistory()).toHaveLength(0);
    });

    it('deletes associated audio file', () => {
      const recordingsDir = path.join(tempDir, 'recordings');
      fs.mkdirSync(recordingsDir, { recursive: true });

      const audioPath = 'test-audio.wav';
      const fullAudioPath = path.join(recordingsDir, audioPath);
      fs.writeFileSync(fullAudioPath, 'fake audio content');

      addEntry({ id: 'entry-1', audioFilePath: audioPath });
      expect(fs.existsSync(fullAudioPath)).toBe(true);

      deleteEntry('entry-1');

      expect(fs.existsSync(fullAudioPath)).toBe(false);
    });

    it('handles missing audio file gracefully', () => {
      addEntry({ id: 'entry-1', audioFilePath: 'nonexistent.wav' });
      expect(() => deleteEntry('entry-1')).not.toThrow();
    });

    it('does not error on nonexistent entry', () => {
      expect(() => deleteEntry('nonexistent')).not.toThrow();
    });
  });

  describe('clearAllHistory', () => {
    it('removes all entries and deletes all audio files', () => {
      const recordingsDir = path.join(tempDir, 'recordings');
      fs.mkdirSync(recordingsDir, { recursive: true });

      for (let i = 0; i < 3; i++) {
        fs.writeFileSync(path.join(recordingsDir, `file-${i}.wav`), 'audio');
        addEntry({ id: `entry-${i}`, audioFilePath: `file-${i}.wav` });
      }

      expect(loadHistory()).toHaveLength(3);
      expect(fs.readdirSync(recordingsDir)).toHaveLength(3);

      clearAllHistory();

      expect(loadHistory()).toHaveLength(0);
      expect(fs.readdirSync(recordingsDir)).toHaveLength(0);
    });

    it('handles empty recordings directory', () => {
      addEntry({ id: 'entry-1', text: 'No audio' });
      expect(() => clearAllHistory()).not.toThrow();
      expect(loadHistory()).toHaveLength(0);
    });
  });

  describe('getRecordingsDir', () => {
    it('returns recordings directory path within userData', () => {
      const recordingsDir = getRecordingsDir();
      expect(recordingsDir).toBe(path.join(tempDir, 'recordings'));
    });
  });

  describe('recoverInterruptedEntries', () => {
    it('removes recording entries and marks transcribing/processing as failed', () => {
      const entries: TranscriptionEntry[] = [
        {
          id: 'entry-1',
          timestamp: '2026-03-11T10:00:00Z',
          durationSeconds: 5,
          status: 'transcribing',
        },
        {
          id: 'entry-2',
          timestamp: '2026-03-11T10:01:00Z',
          durationSeconds: 3,
          status: 'successful',
          text: 'Done',
        },
        {
          id: 'entry-3',
          timestamp: '2026-03-11T10:02:00Z',
          durationSeconds: 0,
          status: 'recording',
        },
        {
          id: 'entry-4',
          timestamp: '2026-03-11T10:03:00Z',
          durationSeconds: 4,
          status: 'processing',
        },
      ];

      const historyPath = path.join(tempDir, 'history.json');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, JSON.stringify(entries), 'utf-8');

      recoverInterruptedEntries();

      const result = loadHistory();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('entry-1');
      expect(result[0].status).toBe('failed');
      expect(result[0].errorMessage).toBe('Interrupted by app restart');
      expect(result[1].id).toBe('entry-2');
      expect(result[1].status).toBe('successful');
      expect(result[2].id).toBe('entry-4');
      expect(result[2].status).toBe('failed');
      expect(result[2].errorMessage).toBe('Interrupted by app restart');
    });

    it('does nothing when no interrupted entries exist', () => {
      const entries: TranscriptionEntry[] = [
        {
          id: 'entry-1',
          timestamp: '2026-03-11T10:00:00Z',
          durationSeconds: 3,
          status: 'successful',
          text: 'Hello',
        },
      ];

      const historyPath = path.join(tempDir, 'history.json');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, JSON.stringify(entries), 'utf-8');

      recoverInterruptedEntries();

      const result = loadHistory();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('successful');
    });
  });
});
