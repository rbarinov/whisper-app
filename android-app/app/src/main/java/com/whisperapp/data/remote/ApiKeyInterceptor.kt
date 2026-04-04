package com.whisperapp.data.remote

import com.whisperapp.data.settings.SecureStorage
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApiKeyInterceptor @Inject constructor(
    private val secureStorage: SecureStorage
) : Interceptor {

    @Volatile private var cachedMainKey: String? = null
    @Volatile private var cachedLlmKey: String? = null

    init {
        refreshKeys()
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val url = originalRequest.url
        val isChatEndpoint = url.encodedPath.contains("chat/completions")

        val apiKey = when {
            isChatEndpoint -> cachedLlmKey?.ifEmpty { cachedMainKey } ?: cachedMainKey
            else -> cachedMainKey
        }

        return if (!apiKey.isNullOrEmpty()) {
            val newRequest = originalRequest.newBuilder()
                .header("Authorization", "Bearer $apiKey")
                .build()
            chain.proceed(newRequest)
        } else {
            chain.proceed(originalRequest)
        }
    }

    fun refreshKeys() {
        cachedMainKey = secureStorage.loadString(SecureStorage.API_KEY)
        cachedLlmKey = secureStorage.loadString(SecureStorage.LLM_API_KEY)
    }
}
