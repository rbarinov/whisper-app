package com.whisperapp.ui.recording

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whisperapp.data.provider.LLMStreamToken
import com.whisperapp.domain.model.AppSettings
import com.whisperapp.domain.model.RecordingState
import com.whisperapp.domain.model.TranscriptionEntry
import com.whisperapp.domain.model.TranscriptionStatus
import com.whisperapp.domain.repository.SettingsRepository
import com.whisperapp.domain.repository.TranscriptionRepository
import com.whisperapp.domain.service.AudioRecorderService
import com.whisperapp.domain.service.LlmService
import com.whisperapp.domain.service.TranscriptionService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class RecordingViewModel @Inject constructor(
    private val audioRecorderService: AudioRecorderService,
    private val transcriptionService: TranscriptionService,
    private val llmService: LlmService,
    private val transcriptionRepository: TranscriptionRepository,
    private val settingsRepository: SettingsRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    val recordingState = MutableStateFlow(RecordingState.IDLE)
    val currentResult = MutableStateFlow("")
    val currentError = MutableStateFlow<String?>(null)
    val processingText = MutableStateFlow("")
    val showRawText = MutableStateFlow(false)

    val settings: StateFlow<AppSettings> = settingsRepository.settings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AppSettings())

    private var transcriptionJob: Job? = null
    private var currentEntryId: String? = null
    private var currentAudioFile: File? = null

    fun startRecording() {
        if (recordingState.value != RecordingState.IDLE) return

        try {
            audioRecorderService.startRecording()
            recordingState.value = RecordingState.RECORDING

            currentEntryId = UUID.randomUUID().toString()
            viewModelScope.launch {
                transcriptionRepository.insertEntry(
                    TranscriptionEntry(
                        id = currentEntryId!!,
                        timestamp = System.currentTimeMillis(),
                        durationSeconds = 0.0,
                        rawText = null,
                        text = null,
                        status = TranscriptionStatus.RECORDING,
                        audioFilePath = null,
                        errorMessage = null
                    )
                )
            }
        } catch (e: Exception) {
            currentError.value = "Failed to start recording: ${e.message}"
            recordingState.value = RecordingState.ERROR
        }
    }

    fun stopRecording() {
        if (recordingState.value != RecordingState.RECORDING) return

        val duration = audioRecorderService.getRecordingDurationSeconds()
        currentAudioFile = audioRecorderService.stopRecording()

        if (currentAudioFile == null || duration < 0.15) {
            currentEntryId?.let { id ->
                viewModelScope.launch {
                    transcriptionRepository.updateAfterProcessing(
                        id = id,
                        text = "",
                        status = TranscriptionStatus.CANCELLED.name,
                        errorMessage = "Recording too short"
                    )
                }
            }
            recordingState.value = RecordingState.IDLE
            currentEntryId = null
            return
        }

        recordingState.value = RecordingState.TRANSCRIBING
        currentEntryId?.let { id ->
            viewModelScope.launch {
                transcriptionRepository.insertEntry(
                    TranscriptionEntry(
                        id = id,
                        timestamp = System.currentTimeMillis(),
                        durationSeconds = duration,
                        rawText = null,
                        text = null,
                        status = TranscriptionStatus.TRANSCRIBING,
                        audioFilePath = currentAudioFile?.absolutePath,
                        errorMessage = null
                    )
                )
            }
        }

        runTranscriptionPipeline()
    }

    fun cancelRecording() {
        if (recordingState.value == RecordingState.RECORDING) {
            audioRecorderService.cancelRecording()
        }
        transcriptionJob?.cancel()
        currentEntryId?.let { id ->
            viewModelScope.launch {
                transcriptionRepository.updateAfterProcessing(
                    id = id,
                    text = "",
                    status = TranscriptionStatus.CANCELLED.name
                )
            }
        }
        resetState()
    }

    fun resetState() {
        recordingState.value = RecordingState.IDLE
        currentResult.value = ""
        currentError.value = null
        processingText.value = ""
        showRawText.value = false
        currentEntryId = null
        currentAudioFile = null
    }

    fun retryRecording(entryId: String) {
        viewModelScope.launch {
            val entry = transcriptionRepository.getEntry(entryId) ?: return@launch
            val audioPath = entry.audioFilePath ?: return@launch
            val audioFile = File(audioPath)
            if (!audioFile.exists()) return@launch

            currentEntryId = entryId
            currentAudioFile = audioFile
            recordingState.value = RecordingState.TRANSCRIBING

            transcriptionRepository.insertEntry(
                entry.copy(status = TranscriptionStatus.TRANSCRIBING)
            )

            runTranscriptionPipeline()
        }
    }

    private fun runTranscriptionPipeline() {
        val audioFile = currentAudioFile ?: return
        val entryId = currentEntryId ?: return

        transcriptionJob = viewModelScope.launch {
            try {
                val appSettings = settings.first()

                val rawText = transcriptionService.transcribe(audioFile, appSettings)
                currentResult.value = rawText
                recordingState.value = RecordingState.DONE

                if (appSettings.llmPostProcessingEnabled) {
                    recordingState.value = RecordingState.PROCESSING
                    processingText.value = ""
                    try {
                        val processedText = StringBuilder()
                        llmService.processTextStream(rawText, appSettings).collect { token ->
                            when (token) {
                                is LLMStreamToken.Content -> {
                                    processedText.append(token.text)
                                    processingText.value = processedText.toString()
                                }
                                is LLMStreamToken.Reasoning -> { }
                            }
                        }
                        val finalText = processedText.toString()
                        currentResult.value = finalText
                        showRawText.value = rawText != finalText

                        transcriptionRepository.updateAfterProcessing(
                            id = entryId,
                            text = finalText,
                            status = TranscriptionStatus.SUCCESSFUL.name
                        )
                    } catch (e: Exception) {
                        showRawText.value = false
                        transcriptionRepository.updateAfterProcessing(
                            id = entryId,
                            text = rawText,
                            status = TranscriptionStatus.SUCCESSFUL.name,
                            errorMessage = "LLM processing failed: ${e.message}"
                        )
                    }
                } else {
                    transcriptionRepository.updateAfterProcessing(
                        id = entryId,
                        text = rawText,
                        status = TranscriptionStatus.SUCCESSFUL.name
                    )
                }

                if (appSettings.autoCopyToClipboard) {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    val clip = android.content.ClipData.newPlainText("Transcription", currentResult.value)
                    clipboard.setPrimaryClip(clip)
                }
            } catch (e: Exception) {
                currentError.value = e.message ?: "Transcription failed"
                recordingState.value = RecordingState.ERROR
                transcriptionRepository.updateAfterProcessing(
                    id = entryId,
                    text = "",
                    status = TranscriptionStatus.FAILED.name,
                    errorMessage = currentError.value
                )
            }
        }
    }
}
