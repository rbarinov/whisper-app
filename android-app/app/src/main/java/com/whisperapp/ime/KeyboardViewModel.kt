package com.whisperapp.ime

import android.view.inputmethod.InputConnection
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whisperapp.data.provider.LLMStreamToken
import com.whisperapp.domain.model.KeyboardState
import com.whisperapp.domain.model.TranscriptionEntry
import com.whisperapp.domain.model.TranscriptionStatus
import com.whisperapp.domain.repository.SettingsRepository
import com.whisperapp.domain.repository.TranscriptionRepository
import com.whisperapp.domain.service.AudioRecorderService
import com.whisperapp.domain.service.LlmService
import com.whisperapp.domain.service.TranscriptionService
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class KeyboardViewModel @Inject constructor(
    private val audioRecorderService: AudioRecorderService,
    private val transcriptionService: TranscriptionService,
    private val llmService: LlmService,
    private val transcriptionRepository: TranscriptionRepository,
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    var keyboardState by mutableStateOf(KeyboardState.IDLE)
        private set

    var resultText by mutableStateOf("")
        private set

    var errorMessage by mutableStateOf("")
        private set

    var isRecordingActive by mutableStateOf(false)
        private set

    private val _processingText = MutableStateFlow("")
    val processingText: StateFlow<String> = _processingText

    private var transcriptionJob: Job? = null
    private var currentEntryId: String? = null
    private var currentAudioFile: File? = null

    fun startRecording() {
        if (keyboardState != KeyboardState.IDLE) return

        try {
            audioRecorderService.startRecording()
            isRecordingActive = true
            keyboardState = KeyboardState.RECORDING

            currentEntryId = UUID.randomUUID().toString()
            val entry = TranscriptionEntry(
                id = currentEntryId!!,
                timestamp = System.currentTimeMillis(),
                durationSeconds = 0.0,
                rawText = null,
                text = null,
                status = TranscriptionStatus.RECORDING,
                audioFilePath = null,
                errorMessage = null
            )
            viewModelScope.launch {
                transcriptionRepository.insertEntry(entry)
            }
        } catch (e: Exception) {
            errorMessage = "Failed to start recording: ${e.message}"
            keyboardState = KeyboardState.ERROR
        }
    }

    fun stopRecording() {
        if (keyboardState != KeyboardState.RECORDING) return

        isRecordingActive = false
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
            keyboardState = KeyboardState.IDLE
            currentEntryId = null
            return
        }

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

        keyboardState = KeyboardState.TRANSCRIBING
        runTranscriptionPipeline()
    }

    fun insertText(inputConnection: InputConnection?) {
        if (resultText.isBlank()) return
        inputConnection?.commitText(resultText, 1)
        clearResult()
    }

    fun clearResult() {
        resultText = ""
        errorMessage = ""
        keyboardState = KeyboardState.IDLE
        currentEntryId = null
        currentAudioFile = null
        transcriptionJob?.cancel()
    }

    fun cancelRecording() {
        if (keyboardState == KeyboardState.RECORDING) {
            audioRecorderService.cancelRecording()
            isRecordingActive = false
        }
        transcriptionJob?.cancel()
        currentEntryId?.let { id ->
            viewModelScope.launch {
                transcriptionRepository.updateAfterProcessing(
                    id = id,
                    text = "",
                    status = TranscriptionStatus.CANCELLED.name,
                    errorMessage = null
                )
            }
        }
        clearResult()
    }

    private fun runTranscriptionPipeline() {
        val audioFile = currentAudioFile ?: return
        val entryId = currentEntryId ?: return

        transcriptionJob = viewModelScope.launch {
            try {
                val settings = settingsRepository.settings.first()

                val rawText = transcriptionService.transcribe(audioFile, settings)

                transcriptionRepository.updateAfterTranscription(
                    id = entryId,
                    rawText = rawText,
                    status = TranscriptionStatus.SUCCESSFUL.name
                )

                if (settings.llmPostProcessingEnabled) {
                    keyboardState = KeyboardState.PROCESSING
                    _processingText.value = ""
                    try {
                        val processedText = StringBuilder()
                        llmService.processTextStream(rawText, settings).collect { token ->
                            when (token) {
                                is LLMStreamToken.Content -> {
                                    processedText.append(token.text)
                                    _processingText.value = processedText.toString()
                                }
                                is LLMStreamToken.Reasoning -> { }
                            }
                        }

                        val finalText = processedText.toString()
                        resultText = finalText
                        transcriptionRepository.updateAfterProcessing(
                            id = entryId,
                            text = finalText,
                            status = TranscriptionStatus.SUCCESSFUL.name,
                            errorMessage = null
                        )
                    } catch (e: Exception) {
                        resultText = rawText
                        transcriptionRepository.updateAfterProcessing(
                            id = entryId,
                            text = rawText,
                            status = TranscriptionStatus.SUCCESSFUL.name,
                            errorMessage = "LLM processing failed: ${e.message}"
                        )
                    }
                } else {
                    resultText = rawText
                }

                keyboardState = KeyboardState.RESULT_READY
            } catch (e: Exception) {
                errorMessage = e.message ?: "Transcription failed"
                keyboardState = KeyboardState.ERROR
                transcriptionRepository.updateAfterProcessing(
                    id = entryId,
                    text = "",
                    status = TranscriptionStatus.FAILED.name,
                    errorMessage = errorMessage
                )
            }
        }
    }
}
