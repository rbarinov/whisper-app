package com.whisperapp.ui.history

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whisperapp.data.provider.LLMStreamToken
import com.whisperapp.domain.model.TranscriptionEntry
import com.whisperapp.domain.model.TranscriptionStatus
import com.whisperapp.domain.repository.SettingsRepository
import com.whisperapp.domain.repository.TranscriptionRepository
import com.whisperapp.domain.service.LlmService
import com.whisperapp.domain.service.TranscriptionService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

@HiltViewModel
class HistoryDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val transcriptionRepository: TranscriptionRepository,
    private val transcriptionService: TranscriptionService,
    private val llmService: LlmService,
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val entryId: String = checkNotNull(savedStateHandle["entryId"])

    val entry: StateFlow<TranscriptionEntry?> = transcriptionRepository.getEntryFlow(entryId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    fun retryEntry() {
        viewModelScope.launch {
            val existing = transcriptionRepository.getEntry(entryId) ?: return@launch
            val audioPath = existing.audioFilePath ?: return@launch
            val audioFile = File(audioPath)
            if (!audioFile.exists()) return@launch

            transcriptionRepository.insertEntry(
                existing.copy(status = TranscriptionStatus.TRANSCRIBING)
            )

            try {
                val appSettings = settingsRepository.settings.first()

                val rawText = transcriptionService.transcribe(audioFile, appSettings)

                if (appSettings.llmPostProcessingEnabled) {
                    transcriptionRepository.insertEntry(
                        existing.copy(status = TranscriptionStatus.PROCESSING)
                    )
                    try {
                        val processedText = StringBuilder()
                        llmService.processTextStream(rawText, appSettings).collect { token ->
                            when (token) {
                                is LLMStreamToken.Content -> processedText.append(token.text)
                                is LLMStreamToken.Reasoning -> { }
                            }
                        }
                        val finalText = processedText.toString()
                        transcriptionRepository.updateAfterProcessing(
                            id = entryId,
                            text = finalText,
                            status = TranscriptionStatus.SUCCESSFUL.name
                        )
                    } catch (e: Exception) {
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
            } catch (e: Exception) {
                transcriptionRepository.updateAfterProcessing(
                    id = entryId,
                    text = "",
                    status = TranscriptionStatus.FAILED.name,
                    errorMessage = e.message ?: "Transcription failed"
                )
            }
        }
    }
}
