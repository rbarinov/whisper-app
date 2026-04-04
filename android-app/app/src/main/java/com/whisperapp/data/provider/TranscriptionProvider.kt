package com.whisperapp.data.provider

import com.whisperapp.data.model.TranscriptionConfig

interface TranscriptionProvider {
    suspend fun transcribe(audioData: ByteArray, config: TranscriptionConfig): String
}
