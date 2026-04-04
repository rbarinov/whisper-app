package com.whisperapp.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.whisperapp.domain.model.TranscriptionEntry

@Database(entities = [TranscriptionEntry::class], version = 1, exportSchema = false)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transcriptionDao(): TranscriptionDao
}
