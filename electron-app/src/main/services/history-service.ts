/**
 * History persistence service for the Electron main process.
 * Reads/writes history.json in the userData directory.
 * Manages audio recordings and crash recovery.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import type { TranscriptionEntry, TranscriptionStatus } from '../../shared/types';
import { HISTORY_MAX_ENTRIES } from '../../shared/constants';

/**
 * Get the path where history.json should be stored.
 * Called at runtime, not module load, for testability.
 */
function getHistoryPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'history.json');
}

/**
 * Get the recordings directory path.
 * Called at runtime, not module load, for testability.
 */
function getRecordingsDirPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'recordings');
}

/**
 * Load history from disk.
 * Returns empty array if file doesn't exist.
 * Performs backward-compatible decoding: missing `status` defaults to 'successful'.
 * Crash recovery: marks `transcribing` entries as `failed` with error message.
 */
export function loadHistory(): TranscriptionEntry[] {
  try {
    const filePath = getHistoryPath();

    // If file doesn't exist, return empty array
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let entries: TranscriptionEntry[] = JSON.parse(fileContent);

    // Backward-compatible: missing `status` defaults to 'successful'
    entries = entries.map((entry) => ({
      ...entry,
      status: (entry.status ?? 'successful') as TranscriptionStatus,
    }));

    // Crash recovery: mark interrupted entries as failed
    entries = entries.map((entry) => {
      if (entry.status === 'transcribing') {
        return {
          ...entry,
          status: 'failed' as const,
          errorMessage: 'Interrupted by app restart',
        };
      }
      return entry;
    });

    return entries;
  } catch (error) {
    // On any error (file not found, invalid JSON, etc.), return empty array
    console.error('Failed to load history:', error);
    return [];
  }
}

/**
 * Save history to disk atomically.
 * Enforces HISTORY_MAX_ENTRIES limit.
 * When trimming old entries, deletes their associated audio files.
 * Writes to temp file first, then renames to avoid corruption.
 */
export function saveHistory(entries: TranscriptionEntry[]): void {
  try {
    const filePath = getHistoryPath();
    const dirPath = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Enforce max entries: keep the first HISTORY_MAX_ENTRIES, delete audio for trimmed entries
    let entriesToSave = entries;
    if (entriesToSave.length > HISTORY_MAX_ENTRIES) {
      const trimmedEntries = entriesToSave.splice(HISTORY_MAX_ENTRIES);
      // Delete audio files for trimmed entries
      for (const entry of trimmedEntries) {
        if (entry.audioFilePath) {
          deleteAudioFile(entry.audioFilePath);
        }
      }
      entriesToSave = entries.slice(0, HISTORY_MAX_ENTRIES);
    }

    // Write to temp file first
    const tempPath = `${filePath}.tmp`;
    const jsonContent = JSON.stringify(entriesToSave, null, 2);
    fs.writeFileSync(tempPath, jsonContent, 'utf-8');

    // Atomic rename
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error('Failed to save history:', error);
    throw error;
  }
}

/**
 * Add a new entry to history.
 * Automatically enforces HISTORY_MAX_ENTRIES limit.
 * Generates UUID if not provided.
 */
export function addEntry(entry: Partial<TranscriptionEntry>): void {
  try {
    const entries = loadHistory();

    // Create complete entry with defaults
    const newEntry: TranscriptionEntry = {
      id: entry.id ?? randomUUID(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      durationSeconds: entry.durationSeconds ?? 0,
      text: entry.text,
      rawText: entry.rawText,
      status: entry.status ?? 'successful',
      audioFilePath: entry.audioFilePath,
      errorMessage: entry.errorMessage,
    };

    entries.unshift(newEntry);
    saveHistory(entries);
  } catch (error) {
    console.error('Failed to add entry:', error);
    throw error;
  }
}

/**
 * Update an existing entry by id.
 * Merges partial updates into the entry.
 */
export function updateEntry(id: string, updates: Partial<TranscriptionEntry>): void {
  try {
    const entries = loadHistory();
    const index = entries.findIndex((e) => e.id === id);

    if (index === -1) {
      throw new Error(`Entry not found: ${id}`);
    }

    entries[index] = {
      ...entries[index],
      ...updates,
      id: entries[index].id, // Never change id
      timestamp: entries[index].timestamp, // Never change timestamp
    };

    saveHistory(entries);
  } catch (error) {
    console.error('Failed to update entry:', error);
    throw error;
  }
}

/**
 * Delete an entry by id.
 * Removes the entry from history and deletes its associated audio file if it exists.
 */
export function deleteEntry(id: string): void {
  try {
    const entries = loadHistory();
    const entryIndex = entries.findIndex((e) => e.id === id);

    if (entryIndex !== -1) {
      const entry = entries[entryIndex];
      // Delete associated audio file
      if (entry.audioFilePath) {
        deleteAudioFile(entry.audioFilePath);
      }
      entries.splice(entryIndex, 1);
      saveHistory(entries);
    }
  } catch (error) {
    console.error('Failed to delete entry:', error);
    throw error;
  }
}

/**
 * Clear all history.
 * Removes all entries and deletes all audio files in recordings directory.
 */
export function clearAllHistory(): void {
  try {
    // Delete all audio files
    const recordingsDir = getRecordingsDirPath();
    if (fs.existsSync(recordingsDir)) {
      const files = fs.readdirSync(recordingsDir);
      for (const file of files) {
        const filePath = path.join(recordingsDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete audio file: ${filePath}`, err);
        }
      }
    }

    // Clear history file
    saveHistory([]);
  } catch (error) {
    console.error('Failed to clear history:', error);
    throw error;
  }
}

/**
 * Get the recordings directory path.
 * Used by IPC handlers to know where to save audio files.
 */
export function getRecordingsDir(): string {
  return getRecordingsDirPath();
}

export function getEntries(): TranscriptionEntry[] {
  return loadHistory();
}

/**
 * Delete an audio file by relative path (within recordings directory).
 * Safe: checks if file exists before deleting.
 */
function deleteAudioFile(relativePath: string): void {
  try {
    const recordingsDir = getRecordingsDirPath();
    const filePath = path.join(recordingsDir, relativePath);

    // Verify path is within recordings directory (prevent path traversal)
    if (!filePath.startsWith(recordingsDir)) {
      console.error(`Invalid audio file path: ${filePath}`);
      return;
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to delete audio file: ${relativePath}`, error);
  }
}
