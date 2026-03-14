import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockLoadSettings,
  mockSaveSettings,
  mockLoadHistory,
  mockDeleteEntry,
  mockClearAllHistory,
  mockAddEntry,
  mockGetRecordingsDir,
  mockUpdateEntry,
  mockGetEntries,
  mockFsExistsSync,
  mockFsReadFileSync,
  mockFsMkdirSync,
  mockFsWriteFileSync,
  mockGetAudioState,
  mockSetActionCallback,
  mockSetHotkey,
  mockSetCancelKey,
  mockSetRecordingState,
  mockStart,
  mockStop,
  mockIsWaylandSession,
  mockSaveRecording,
  mockEncodeWAV,
  mockProcessWithLLM,
  mockPasteText,
  mockTranscribe,
} = vi.hoisted(() => ({
  mockLoadSettings: vi.fn(),
  mockSaveSettings: vi.fn(),
  mockLoadHistory: vi.fn(),
  mockDeleteEntry: vi.fn(),
  mockClearAllHistory: vi.fn(),
  mockAddEntry: vi.fn(),
  mockGetRecordingsDir: vi.fn(),
  mockUpdateEntry: vi.fn(),
  mockGetEntries: vi.fn(),
  mockFsExistsSync: vi.fn(),
  mockFsReadFileSync: vi.fn(),
  mockFsMkdirSync: vi.fn(),
  mockFsWriteFileSync: vi.fn(),
  mockGetAudioState: vi.fn(),
  mockSetActionCallback: vi.fn(),
  mockSetHotkey: vi.fn(),
  mockSetCancelKey: vi.fn(),
  mockSetRecordingState: vi.fn(),
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  mockIsWaylandSession: vi.fn(),
  mockSaveRecording: vi.fn(),
  mockEncodeWAV: vi.fn(),
  mockProcessWithLLM: vi.fn(),
  mockPasteText: vi.fn(),
  mockTranscribe: vi.fn(),
}));

vi.mock('../../src/main/services/settings-service', () => ({
  loadSettings: mockLoadSettings,
  saveSettings: mockSaveSettings,
}));

vi.mock('../../src/main/services/history-service', () => ({
  loadHistory: mockLoadHistory,
  deleteEntry: mockDeleteEntry,
  clearAllHistory: mockClearAllHistory,
  addEntry: mockAddEntry,
  getRecordingsDir: mockGetRecordingsDir,
  updateEntry: mockUpdateEntry,
  getEntries: mockGetEntries,
}));

vi.mock('../../src/main/services/audio-player-service', () => ({
  audioPlayerService: {
    getState: mockGetAudioState,
    stop: vi.fn(),
    toggle: vi.fn(),
  },
}));

vi.mock('../../src/main/services/hotkey-manager', () => ({
  HotkeyManager: class {
    setActionCallback = mockSetActionCallback;
    setHotkey = mockSetHotkey;
    setCancelKey = mockSetCancelKey;
    setRecordingState = mockSetRecordingState;
    start = mockStart;
    stop = mockStop;
  },
}));

vi.mock('../../src/main/services/paste-service', () => ({
  isWaylandSession: mockIsWaylandSession,
  pasteText: mockPasteText,
}));

vi.mock('../../src/main/services/audio-recorder', () => ({
  saveRecording: mockSaveRecording,
  encodeWAV: mockEncodeWAV,
}));

vi.mock('../../src/main/services/llm-service', () => ({
  processWithLLMStream: mockProcessWithLLM,
}));

vi.mock('../../src/main/services/transcription-service', () => ({
  transcribe: mockTranscribe,
}));

vi.mock('fs', () => ({
  existsSync: mockFsExistsSync,
  readFileSync: mockFsReadFileSync,
  mkdirSync: mockFsMkdirSync,
  writeFileSync: mockFsWriteFileSync,
}));

import { IPC } from '../../src/shared/ipc-channels';
import type { AppSettings } from '../../src/shared/types';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';
import { AppStateManager } from '../../src/main/app-state';

describe('AppStateManager', () => {
  async function flushLifecycle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      apiBaseURL: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      modelName: 'whisper-1',
      language: '',
      hotkeyConfig: {
        keyCode: 63,
        keyName: 'F5',
        modifiers: undefined,
      },
      cancelKeyConfig: {
        keyCode: 1,
        keyName: 'Escape',
        modifiers: undefined,
      },
      llmPostProcessingEnabled: false,
      llmModelName: 'gpt-5-nano',
      llmSystemPrompt: 'prompt',
    };

    mockLoadSettings.mockReturnValue(settings);
    mockLoadHistory.mockReturnValue([]);
    mockGetAudioState.mockReturnValue({
      isPlaying: false,
      playingEntryId: null,
      playingFilePath: null,
    });
    mockIsWaylandSession.mockReturnValue(false);
    mockGetRecordingsDir.mockReturnValue('/tmp/recordings');
    mockGetEntries.mockReturnValue([]);
    mockFsExistsSync.mockReturnValue(false);
    mockFsReadFileSync.mockReturnValue(Buffer.from(''));
    mockFsMkdirSync.mockReturnValue(undefined);
    mockFsWriteFileSync.mockReturnValue(undefined);
    mockSaveRecording.mockResolvedValue({
      filePath: '/tmp/recordings/recording.wav',
      duration: 1,
      sampleCount: 16000,
    });
    mockEncodeWAV.mockReturnValue(Buffer.from('fake-wav'));
    mockTranscribe.mockResolvedValue('raw text');
    mockProcessWithLLM.mockResolvedValue('llm text');
    mockPasteText.mockResolvedValue({ success: true, method: 'keyboard' });
  });

  it('initializes with idle recording and hidden overlay', () => {
    const manager = new AppStateManager();

    const snapshot = manager.getSnapshot();
    expect(snapshot.recordingState).toEqual({ type: 'idle' });
    expect(snapshot.overlayState).toEqual({ type: 'hidden' });
  });

  it('broadcasts state update with expected snapshot shape', () => {
    const manager = new AppStateManager();
    const send = vi.fn();

    const mainWindow = {
      isDestroyed: () => false,
      webContents: {
        send,
      },
    };

    manager.setMainWindow(mainWindow as never);
    (manager as never as { broadcastStateUpdate: () => void }).broadcastStateUpdate();

    expect(send).toHaveBeenCalledTimes(1);
    const [channel, payload] = send.mock.calls[0];
    expect(channel).toBe(IPC.STATE_UPDATE);
    expect(payload).toMatchObject({
      recordingState: { type: 'idle' },
      overlayState: { type: 'hidden' },
      history: [],
      isMicrophoneGranted: false,
      isAudioPlaying: false,
      playingEntryId: null,
      isWayland: false,
    });
  });

  it('startRecording sets recordingState to recording', () => {
    const manager = new AppStateManager();

    manager.startRecording();

    expect(manager.getSnapshot().recordingState).toEqual({ type: 'recording' });
  });

  it('cancelRecording when idle does nothing', () => {
    const manager = new AppStateManager();

    manager.cancelRecording();

    expect(manager.getSnapshot().recordingState).toEqual({ type: 'idle' });
    expect(manager.getSnapshot().overlayState).toEqual({ type: 'hidden' });
  });

  it('runs full flow without LLM: transcribe -> paste -> successful history update', async () => {
    const manager = new AppStateManager();

    manager.startRecording();
    manager.stopRecordingAndTranscribe();
    manager.handleRecordingData({
      samples: new Float32Array([0.1, 0.2, -0.1, 0.05]),
      inputSampleRate: 48000,
    });

    await flushLifecycle();

    expect(mockAddEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'transcribing',
      })
    );
    expect(mockTranscribe).toHaveBeenCalledTimes(1);
    expect(mockTranscribe).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        apiBaseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        modelName: 'whisper-1',
        language: '',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(mockProcessWithLLM).not.toHaveBeenCalled();
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: 'successful',
        text: 'raw text',
        rawText: 'raw text',
      })
    );
    expect(mockPasteText).toHaveBeenCalledWith('raw text');
    expect(manager.getSnapshot().recordingState).toEqual({ type: 'idle' });
    expect(manager.getSnapshot().overlayState).toEqual({ type: 'done', text: 'raw text' });
  });

  it('runs full flow with LLM enabled: transcribe -> process -> paste processed text', async () => {
    mockLoadSettings.mockReturnValue({
      ...DEFAULT_SETTINGS,
      apiBaseURL: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      modelName: 'whisper-1',
      language: '',
      hotkeyConfig: {
        keyCode: 63,
        keyName: 'F5',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      },
      cancelKeyConfig: {
        keyCode: 1,
        keyName: 'Escape',
        modifiers: undefined,
      },
      llmPostProcessingEnabled: true,
      llmModelName: 'gpt-5-nano',
      llmSystemPrompt: 'prompt',
    });

    const manager = new AppStateManager();
    const overlaySend = vi.fn();
    manager.setOverlayWindow({
      isDestroyed: () => false,
      webContents: {
        send: overlaySend,
      },
    } as never);

    manager.startRecording();
    manager.stopRecordingAndTranscribe();
    manager.handleRecordingData({
      samples: new Float32Array([0.3, -0.2, 0.15, -0.05]),
      inputSampleRate: 44100,
    });

    await flushLifecycle();

    expect(mockProcessWithLLM).toHaveBeenCalledWith(
      'raw text',
      expect.objectContaining({
        apiBaseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        llmModelName: 'gpt-5-nano',
        llmSystemPrompt: 'prompt',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: 'successful',
        text: 'llm text',
        rawText: 'raw text',
      })
    );
    expect(mockPasteText).toHaveBeenCalledWith('llm text');

    const overlayStates = overlaySend.mock.calls
      .filter(([channel]) => channel === IPC.OVERLAY_UPDATE)
      .map(([, payload]) => payload);
    expect(overlayStates).toEqual(
      expect.arrayContaining([
        { type: 'recording' },
        { type: 'transcribing' },
        { type: 'processing' },
        { type: 'done', text: 'llm text' },
      ])
    );
  });

  it('uses custom LLM credentials when they are configured', async () => {
    mockLoadSettings.mockReturnValue({
      ...DEFAULT_SETTINGS,
      apiBaseURL: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      modelName: 'whisper-1',
      language: '',
      hotkeyConfig: {
        keyCode: 63,
        keyName: 'F5',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      },
      cancelKeyConfig: {
        keyCode: 1,
        keyName: 'Escape',
        modifiers: undefined,
      },
      llmPostProcessingEnabled: true,
      llmApiBaseURL: 'https://llm.example.com',
      llmApiKey: 'llm-key',
      llmModelName: 'gpt-5-nano',
      llmSystemPrompt: 'prompt',
    });

    const manager = new AppStateManager();

    manager.startRecording();
    manager.stopRecordingAndTranscribe();
    manager.handleRecordingData({
      samples: new Float32Array([0.3, -0.2, 0.15, -0.05]),
      inputSampleRate: 44100,
    });

    await flushLifecycle();

    expect(mockProcessWithLLM).toHaveBeenCalledWith(
      'raw text',
      expect.objectContaining({
        apiBaseURL: 'https://llm.example.com',
        apiKey: 'llm-key',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('falls back to raw text when LLM fails and stores LLM error message', async () => {
    mockLoadSettings.mockReturnValue({
      ...DEFAULT_SETTINGS,
      apiBaseURL: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      modelName: 'whisper-1',
      language: '',
      hotkeyConfig: {
        keyCode: 63,
        keyName: 'F5',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      },
      cancelKeyConfig: {
        keyCode: 1,
        keyName: 'Escape',
        modifiers: undefined,
      },
      llmPostProcessingEnabled: true,
      llmModelName: 'gpt-5-nano',
      llmSystemPrompt: 'prompt',
    });
    mockProcessWithLLM.mockRejectedValueOnce(new Error('model overload'));

    const manager = new AppStateManager();

    manager.startRecording();
    manager.stopRecordingAndTranscribe();
    manager.handleRecordingData({
      samples: new Float32Array([0.1, 0.1, 0.1]),
      inputSampleRate: 48000,
    });

    await flushLifecycle();

    expect(mockUpdateEntry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: 'successful',
        text: 'raw text',
        rawText: 'raw text',
        errorMessage: expect.stringContaining('LLM failed:'),
      })
    );
    expect(mockPasteText).toHaveBeenCalledWith('raw text');
    expect(manager.getSnapshot().overlayState).toEqual({ type: 'done', text: 'raw text' });
  });

  it('cancel during recording >=0.5s creates cancelled entry with audio file', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000);
    nowSpy.mockReturnValueOnce(1700);

    const manager = new AppStateManager();

    manager.startRecording();
    manager.handleRecordingData({
      samples: new Float32Array([0.1, 0.2, 0.3]),
      inputSampleRate: 48000,
    });
    manager.cancelRecording();

    expect(mockAddEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        audioFilePath: expect.stringMatching(/\.wav$/),
      })
    );
    expect(manager.getSnapshot().recordingState).toEqual({ type: 'idle' });
    expect(manager.getSnapshot().overlayState).toEqual({ type: 'cancelled' });
  });

  it('cancel during recording <0.5s does not create entry', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1200);

    const manager = new AppStateManager();

    manager.startRecording();
    manager.handleRecordingData({
      samples: new Float32Array([0.1, 0.2]),
      inputSampleRate: 48000,
    });
    manager.cancelRecording();

    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(manager.getSnapshot().recordingState).toEqual({ type: 'idle' });
    expect(manager.getSnapshot().overlayState).toEqual({ type: 'cancelled' });
  });

  it('cancel during transcription marks entry cancelled and aborts request', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockTranscribe.mockImplementationOnce(
      (_buffer: Buffer, _settings: unknown, options: { signal?: AbortSignal }) => {
        capturedSignal = options.signal;
        return new Promise<string>((_resolve, reject) => {
          options.signal?.addEventListener(
            'abort',
            () => reject(new Error('Request aborted')),
            { once: true }
          );
        });
      }
    );

    const manager = new AppStateManager();

    manager.startRecording();
    manager.stopRecordingAndTranscribe();
    manager.handleRecordingData({
      samples: new Float32Array([0.1, 0.2, 0.3]),
      inputSampleRate: 48000,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const entryId = mockAddEntry.mock.calls[0][0].id as string;

    manager.cancelRecording();
    await flushLifecycle();

    expect(capturedSignal?.aborted).toBe(true);
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      entryId,
      expect.objectContaining({ status: 'cancelled' })
    );
    expect(manager.getSnapshot().recordingState).toEqual({ type: 'idle' });
    expect(manager.getSnapshot().overlayState).toEqual({ type: 'cancelled' });
  });

  it('retry from failed creates new successful entry', async () => {
    mockFsExistsSync.mockReturnValue(true);
    mockFsReadFileSync.mockReturnValue(Buffer.from('stored-wav'));
    mockGetEntries.mockReturnValue([
      {
        id: 'failed-1',
        timestamp: new Date().toISOString(),
        durationSeconds: 1,
        status: 'failed',
        audioFilePath: 'failed-1.wav',
      },
    ]);
    mockTranscribe.mockResolvedValueOnce('retry text');

    const manager = new AppStateManager();
    manager.retryTranscription('failed-1');

    await flushLifecycle();

    const retryId = mockAddEntry.mock.calls[0][0].id as string;
    expect(retryId).not.toBe('failed-1');
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      retryId,
      expect.objectContaining({
        status: 'successful',
        text: 'retry text',
        rawText: 'retry text',
        audioFilePath: 'failed-1.wav',
      })
    );
  });

  it('retry from cancelled creates new successful entry', async () => {
    mockFsExistsSync.mockReturnValue(true);
    mockFsReadFileSync.mockReturnValue(Buffer.from('stored-wav'));
    mockGetEntries.mockReturnValue([
      {
        id: 'cancelled-1',
        timestamp: new Date().toISOString(),
        durationSeconds: 1,
        status: 'cancelled',
        audioFilePath: 'cancelled-1.wav',
      },
    ]);
    mockTranscribe.mockResolvedValueOnce('retry cancelled text');

    const manager = new AppStateManager();
    manager.retryTranscription('cancelled-1');

    await flushLifecycle();

    const retryId = mockAddEntry.mock.calls[0][0].id as string;
    expect(retryId).not.toBe('cancelled-1');
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      retryId,
      expect.objectContaining({
        status: 'successful',
        text: 'retry cancelled text',
        rawText: 'retry cancelled text',
        audioFilePath: 'cancelled-1.wav',
      })
    );
  });
});
