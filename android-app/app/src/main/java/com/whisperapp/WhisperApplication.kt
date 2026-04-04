package com.whisperapp

import android.app.Application
import com.whisperapp.data.remote.ApiKeyInterceptor
import com.whisperapp.domain.repository.SettingsRepository
import com.whisperapp.domain.repository.TranscriptionRepository
import com.whisperapp.domain.service.AudioRecorderService
import com.whisperapp.domain.service.LlmService
import com.whisperapp.domain.service.TranscriptionService
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class WhisperApplication : Application() {

    @Inject lateinit var transcriptionService: TranscriptionService
    @Inject lateinit var llmService: LlmService
    @Inject lateinit var audioRecorderService: AudioRecorderService
    @Inject lateinit var transcriptionRepository: TranscriptionRepository
    @Inject lateinit var settingsRepository: SettingsRepository
    @Inject lateinit var apiKeyInterceptor: ApiKeyInterceptor

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        applicationScope.launch {
            apiKeyInterceptor.refreshKeys()
            transcriptionRepository.recoverInterruptedEntries()
        }
    }
}
