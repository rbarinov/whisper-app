package com.whisperapp.data.remote

import com.whisperapp.data.settings.SecureStorage
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApiKeyInterceptor @Inject constructor(
    private val secureStorage: SecureStorage
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val url = originalRequest.url
        val isChatEndpoint = url.encodedPath.contains("chat/completions")

        val keys = runBlocking {
            val llmKey = secureStorage.loadString(SecureStorage.LLM_API_KEY)
            val mainKey = secureStorage.loadString(SecureStorage.API_KEY)
            Pair(mainKey, llmKey)
        }

        val apiKey = when {
            isChatEndpoint -> keys.second.ifEmpty { keys.first }
            else -> keys.first
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
}
