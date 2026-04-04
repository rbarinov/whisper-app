package com.whisperapp

import android.app.Application
import com.whisperapp.data.remote.ApiKeyInterceptor
import com.whisperapp.domain.repository.TranscriptionRepository
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class WhisperApplication : Application() {

    @Inject lateinit var transcriptionRepository: TranscriptionRepository
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
