package com.whisperapp.data.model

import com.whisperapp.domain.model.AppSettings

data class TranscriptionConfig(
    val apiKey: String,
    val apiBaseURL: String,
    val modelName: String,
    val language: String
)

data class LLMConfig(
    val apiKey: String,
    val apiBaseURL: String,
    val modelName: String,
    val systemPrompt: String
)

fun AppSettings.toTranscriptionConfig() = TranscriptionConfig(
    apiKey = apiKey,
    apiBaseURL = apiBaseUrl,
    modelName = modelName,
    language = language
)

fun AppSettings.toLLMConfig() = LLMConfig(
    apiKey = effectiveLlmApiKey,
    apiBaseURL = effectiveLlmApiBaseUrl,
    modelName = llmModelName,
    systemPrompt = llmSystemPrompt
)
