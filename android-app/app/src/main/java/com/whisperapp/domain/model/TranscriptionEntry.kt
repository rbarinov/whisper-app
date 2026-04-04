package com.whisperapp.domain.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transcription_entries")
data class TranscriptionEntry(
    @PrimaryKey val id: String,
    val timestamp: Long,
    val durationSeconds: Double,
    val rawText: String?,
    val text: String?,
    val status: TranscriptionStatus,
    val audioFilePath: String?,
    val errorMessage: String?
)
