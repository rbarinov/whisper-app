package com.whisperapp.data.repository

import android.content.Context
import com.whisperapp.data.local.TranscriptionDao
import com.whisperapp.data.preferences.SettingsDataStore
import com.whisperapp.data.settings.SecureStorage
import com.whisperapp.domain.model.AppSettings
import com.whisperapp.domain.model.TranscriptionEntry
import com.whisperapp.domain.repository.SettingsRepository
import com.whisperapp.domain.repository.TranscriptionRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TranscriptionRepositoryImpl @Inject constructor(
    private val dao: TranscriptionDao
) : TranscriptionRepository {

    override fun getAllEntries(): Flow<List<TranscriptionEntry>> = dao.getAll()

    override suspend fun getEntry(id: String): TranscriptionEntry? = dao.getById(id)

    override suspend fun insertEntry(entry: TranscriptionEntry) {
        dao.insert(entry)
        trimHistory()
    }

    override suspend fun updateAfterTranscription(id: String, rawText: String, status: String) {
        dao.updateAfterTranscription(id, rawText, status)
    }

    override suspend fun updateAfterProcessing(id: String, text: String, status: String, errorMessage: String?) {
        dao.updateAfterProcessing(id, text, status, errorMessage)
    }

    override suspend fun deleteEntry(id: String) = dao.delete(id)

    override suspend fun deleteAllEntries() = dao.deleteAll()

    private suspend fun trimHistory() {
        val count = dao.count()
        if (count > SettingsDataStore.MAX_HISTORY_ENTRIES) {
            val entries = dao.getAll().first()
            val toDelete = entries.drop(SettingsDataStore.MAX_HISTORY_ENTRIES)
            toDelete.forEach { dao.delete(it.id) }
        }
    }
}

@Singleton
class SettingsRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val secureStorage: SecureStorage
) : SettingsRepository {

    private val dataStore = SettingsDataStore(context, secureStorage)

    override val settings: Flow<AppSettings> = dataStore.settings

    override suspend fun updateSettings(transform: (AppSettings) -> AppSettings) {
        dataStore.updateSettings(transform)
    }

    override suspend fun getSettingsOnce(): AppSettings = settings.first()
}
