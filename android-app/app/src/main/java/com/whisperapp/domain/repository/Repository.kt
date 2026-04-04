package com.whisperapp.domain.repository

import com.whisperapp.domain.model.AppSettings
import com.whisperapp.domain.model.TranscriptionEntry
import kotlinx.coroutines.flow.Flow

interface TranscriptionRepository {
    fun getAllEntries(): Flow<List<TranscriptionEntry>>
    fun getEntryFlow(id: String): Flow<TranscriptionEntry?>
    suspend fun getEntry(id: String): TranscriptionEntry?
    suspend fun insertEntry(entry: TranscriptionEntry)
    suspend fun updateAfterTranscription(id: String, rawText: String, status: String)
    suspend fun updateAfterProcessing(id: String, text: String, status: String, errorMessage: String? = null)
    suspend fun deleteEntry(id: String)
    suspend fun deleteAllEntries()
    suspend fun recoverInterruptedEntries()
}

interface SettingsRepository {
    val settings: Flow<AppSettings>
    suspend fun updateSettings(transform: (AppSettings) -> AppSettings)
    suspend fun getSettingsOnce(): AppSettings
}
