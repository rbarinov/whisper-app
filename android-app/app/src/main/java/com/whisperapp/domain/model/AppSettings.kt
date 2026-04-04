package com.whisperapp.domain.model

import com.whisperapp.util.AppConstants

data class AppSettings(
    val apiBaseUrl: String = AppConstants.DEFAULT_API_BASE_URL,
    val apiKey: String = "",
    val modelName: String = AppConstants.DEFAULT_MODEL_NAME,
    val language: String = "en",
    val llmPostProcessingEnabled: Boolean = false,
    val llmApiBaseUrl: String = "",
    val llmApiKey: String = "",
    val llmModelName: String = AppConstants.DEFAULT_LLM_MODEL_NAME,
    val llmSystemPrompt: String = AppConstants.DEFAULT_LLM_SYSTEM_PROMPT,
    val autoCopyToClipboard: Boolean = true,
    val onboardingCompleted: Boolean = false
) {
    val effectiveLlmApiBaseUrl: String
        get() = llmApiBaseUrl.ifEmpty { apiBaseUrl }

    val effectiveLlmApiKey: String
        get() = llmApiKey.ifEmpty { apiKey }
}
