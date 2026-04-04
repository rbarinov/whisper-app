package com.whisperapp.data.local

import androidx.room.TypeConverter
import com.whisperapp.domain.model.TranscriptionStatus

class Converters {
    @TypeConverter
    fun fromTranscriptionStatus(status: TranscriptionStatus): String = status.name

    @TypeConverter
    fun toTranscriptionStatus(value: String): TranscriptionStatus = TranscriptionStatus.valueOf(value)
}
