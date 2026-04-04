package com.whisperapp.data.provider

import com.whisperapp.data.model.LLMConfig
import kotlinx.coroutines.flow.Flow

sealed class LLMStreamToken {
    data class Content(val text: String) : LLMStreamToken()
    data class Reasoning(val text: String) : LLMStreamToken()
}

interface LLMProvider {
    suspend fun process(text: String, config: LLMConfig): String
    fun processStream(text: String, config: LLMConfig): Flow<LLMStreamToken>
}
