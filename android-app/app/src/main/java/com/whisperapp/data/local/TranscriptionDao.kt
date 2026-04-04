package com.whisperapp.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.whisperapp.domain.model.TranscriptionEntry
import kotlinx.coroutines.flow.Flow

@Dao
interface TranscriptionDao {
    @Query("SELECT * FROM transcription_entries ORDER BY timestamp DESC")
    fun getAll(): Flow<List<TranscriptionEntry>>

    @Query("SELECT * FROM transcription_entries WHERE id = :id")
    suspend fun getById(id: String): TranscriptionEntry?

    @Query("SELECT * FROM transcription_entries WHERE id = :id")
    fun observeById(id: String): Flow<TranscriptionEntry?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: TranscriptionEntry)

    @Query("UPDATE transcription_entries SET rawText = :rawText, status = :status WHERE id = :id")
    suspend fun updateAfterTranscription(id: String, rawText: String, status: String)

    @Query("UPDATE transcription_entries SET text = :text, status = :status, errorMessage = :errorMessage WHERE id = :id")
    suspend fun updateAfterProcessing(id: String, text: String, status: String, errorMessage: String?)

    @Query("DELETE FROM transcription_entries WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM transcription_entries")
    suspend fun deleteAll()

    @Query("SELECT COUNT(*) FROM transcription_entries")
    suspend fun count(): Int

    @Query("UPDATE transcription_entries SET status = 'FAILED', errorMessage = 'Interrupted by app restart' WHERE status IN ('RECORDING', 'TRANSCRIBING', 'PROCESSING')")
    suspend fun recoverInterruptedEntries()
}
