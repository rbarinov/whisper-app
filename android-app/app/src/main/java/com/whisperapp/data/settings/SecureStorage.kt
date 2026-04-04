package com.whisperapp.data.settings

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.whisperapp.util.AppConstants
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecureStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val prefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            context,
            AppConstants.SECURE_PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    fun loadString(key: String): String? {
        return prefs.getString(key, null)
    }

    fun delete(key: String) {
        prefs.edit().remove(key).apply()
    }

    companion object Keys {
        const val API_KEY = "whisper_api_key"
        const val LLM_API_KEY = "whisper_llm_api_key"
    }
}
