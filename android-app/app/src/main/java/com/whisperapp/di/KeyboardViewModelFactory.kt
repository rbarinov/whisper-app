package com.whisperapp.di

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.whisperapp.domain.repository.SettingsRepository
import com.whisperapp.domain.repository.TranscriptionRepository
import com.whisperapp.domain.service.AudioRecorderService
import com.whisperapp.domain.service.LlmService
import com.whisperapp.domain.service.TranscriptionService
import com.whisperapp.ime.KeyboardViewModel
import javax.inject.Inject

class KeyboardViewModelFactory @Inject constructor(
    private val audioRecorderService: AudioRecorderService,
    private val transcriptionService: TranscriptionService,
    private val llmService: LlmService,
    private val transcriptionRepository: TranscriptionRepository,
    private val settingsRepository: SettingsRepository
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(KeyboardViewModel::class.java)) {
            return KeyboardViewModel(
                audioRecorderService = audioRecorderService,
                transcriptionService = transcriptionService,
                llmService = llmService,
                transcriptionRepository = transcriptionRepository,
                settingsRepository = settingsRepository
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
