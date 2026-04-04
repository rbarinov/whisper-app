package com.whisperapp.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.whisperapp.data.remote.ApiKeyInterceptor
import com.whisperapp.data.settings.SecureStorage
import com.whisperapp.domain.model.AppSettings
import com.whisperapp.util.AppConstants
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class SettingsDataStore(
    private val context: Context,
    private val secureStorage: SecureStorage,
    private val apiKeyInterceptor: ApiKeyInterceptor
) {

    companion object {
        private val KEY_API_BASE_URL = stringPreferencesKey("api_base_url")
        private val KEY_MODEL_NAME = stringPreferencesKey("model_name")
        private val KEY_LANGUAGE = stringPreferencesKey("language")
        private val KEY_LLM_ENABLED = booleanPreferencesKey("llm_post_processing_enabled")
        private val KEY_LLM_API_BASE_URL = stringPreferencesKey("llm_api_base_url")
        private val KEY_LLM_MODEL_NAME = stringPreferencesKey("llm_model_name")
        private val KEY_LLM_SYSTEM_PROMPT = stringPreferencesKey("llm_system_prompt")
        private val KEY_AUTO_COPY = booleanPreferencesKey("auto_copy_to_clipboard")
        private val KEY_ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")

        const val MAX_HISTORY_ENTRIES = AppConstants.HISTORY_MAX_ENTRIES
    }

    val settings: Flow<AppSettings> = context.settingsDataStore.data.map { prefs ->
        AppSettings(
            apiBaseUrl = prefs[KEY_API_BASE_URL] ?: AppConstants.DEFAULT_API_BASE_URL,
            apiKey = secureStorage.loadString(SecureStorage.API_KEY) ?: "",
            modelName = prefs[KEY_MODEL_NAME] ?: AppConstants.DEFAULT_MODEL_NAME,
            language = prefs[KEY_LANGUAGE] ?: "",
            llmPostProcessingEnabled = prefs[KEY_LLM_ENABLED] ?: false,
            llmApiBaseUrl = prefs[KEY_LLM_API_BASE_URL] ?: "",
            llmApiKey = secureStorage.loadString(SecureStorage.LLM_API_KEY) ?: "",
            llmModelName = prefs[KEY_LLM_MODEL_NAME] ?: AppConstants.DEFAULT_LLM_MODEL_NAME,
            llmSystemPrompt = prefs[KEY_LLM_SYSTEM_PROMPT] ?: AppConstants.DEFAULT_LLM_SYSTEM_PROMPT,
            autoCopyToClipboard = prefs[KEY_AUTO_COPY] ?: true,
            onboardingCompleted = prefs[KEY_ONBOARDING_COMPLETED] ?: false
        )
    }

    suspend fun updateSettings(transform: (AppSettings) -> AppSettings) {
        context.settingsDataStore.edit { prefs ->
            val current = prefs.toAppSettings()
            val updated = transform(current)

            // Store API keys in encrypted storage
            if (updated.apiKey.isNotEmpty()) {
                secureStorage.saveString(SecureStorage.API_KEY, updated.apiKey)
            }
            if (updated.llmApiKey.isNotEmpty()) {
                secureStorage.saveString(SecureStorage.LLM_API_KEY, updated.llmApiKey)
            }

            apiKeyInterceptor.refreshKeys()

            // Store non-sensitive settings in DataStore
            prefs[KEY_API_BASE_URL] = updated.apiBaseUrl
            prefs[KEY_MODEL_NAME] = updated.modelName
            prefs[KEY_LANGUAGE] = updated.language
            prefs[KEY_LLM_ENABLED] = updated.llmPostProcessingEnabled
            prefs[KEY_LLM_API_BASE_URL] = updated.llmApiBaseUrl
            prefs[KEY_LLM_MODEL_NAME] = updated.llmModelName
            prefs[KEY_LLM_SYSTEM_PROMPT] = updated.llmSystemPrompt
            prefs[KEY_AUTO_COPY] = updated.autoCopyToClipboard
            prefs[KEY_ONBOARDING_COMPLETED] = updated.onboardingCompleted
        }
    }

    private fun Preferences.toAppSettings(): AppSettings = AppSettings(
        apiBaseUrl = this[KEY_API_BASE_URL] ?: AppConstants.DEFAULT_API_BASE_URL,
        apiKey = secureStorage.loadString(SecureStorage.API_KEY) ?: "",
        modelName = this[KEY_MODEL_NAME] ?: AppConstants.DEFAULT_MODEL_NAME,
        language = this[KEY_LANGUAGE] ?: "",
        llmPostProcessingEnabled = this[KEY_LLM_ENABLED] ?: false,
        llmApiBaseUrl = this[KEY_LLM_API_BASE_URL] ?: "",
        llmApiKey = secureStorage.loadString(SecureStorage.LLM_API_KEY) ?: "",
        llmModelName = this[KEY_LLM_MODEL_NAME] ?: AppConstants.DEFAULT_LLM_MODEL_NAME,
        llmSystemPrompt = this[KEY_LLM_SYSTEM_PROMPT] ?: AppConstants.DEFAULT_LLM_SYSTEM_PROMPT,
        autoCopyToClipboard = this[KEY_AUTO_COPY] ?: true,
        onboardingCompleted = this[KEY_ONBOARDING_COMPLETED] ?: false
    )
}
