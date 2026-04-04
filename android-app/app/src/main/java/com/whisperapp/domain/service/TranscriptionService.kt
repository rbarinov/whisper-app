package com.whisperapp.domain.service

import android.util.Log
import com.google.gson.Gson
import com.whisperapp.data.provider.LLMStreamToken
import com.whisperapp.data.provider.ProviderError
import com.whisperapp.data.remote.LlmApi
import com.whisperapp.data.remote.WhisperApi
import com.whisperapp.data.remote.dto.ChatCompletionRequest
import com.whisperapp.data.remote.dto.ChatDelta
import com.whisperapp.data.remote.dto.ChatMessage
import com.whisperapp.domain.model.AppSettings
import com.whisperapp.util.AppConstants
import com.whisperapp.util.RetryOptions
import com.whisperapp.util.defaultShouldRetry
import com.whisperapp.util.retryWithBackoff
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withTimeout
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TranscriptionService @Inject constructor(
    private val whisperApi: WhisperApi,
    private val gson: Gson
) {
    companion object {
        private const val TAG = "TranscriptionService"
    }
    suspend fun transcribe(
        audioFile: File,
        settings: AppSettings
    ): String {
        validateTranscriptionConfig(settings)

        val requestBody = audioFile.asRequestBody("audio/wav".toMediaType())
        val filePart = MultipartBody.Part.createFormData("file", audioFile.name, requestBody)
        val url = "${settings.apiBaseUrl}/audio/transcriptions"

        return retryWithBackoff(
            block = {
                val response = whisperApi.transcribeRaw(
                    url = url,
                    file = filePart,
                    model = settings.modelName.toRequestBody("text/plain".toMediaType()),
                    responseFormat = "json".toRequestBody("text/plain".toMediaType()),
                    language = settings.language.takeIf { it.isNotBlank() && it != "en" }
                        ?.toRequestBody("text/plain".toMediaType())
                )

                if (!response.isSuccessful) {
                    val errorBody = response.errorBody()?.string() ?: response.message()
                    throw ProviderError.ApiError(response.code(), errorBody)
                }

                val body = response.body()?.string()
                    ?: throw ProviderError.DecodingError("Empty response body")

                try {
                    val result = gson.fromJson(body, TranscriptionResult::class.java)
                    result.text ?: throw ProviderError.DecodingError("Empty transcription text in response")
                } catch (e: ProviderError) {
                    throw e
                } catch (e: Exception) {
                    throw ProviderError.DecodingError(e.message ?: "Failed to parse transcription response")
                }
            },
            options = RetryOptions(
                maxRetries = AppConstants.MAX_RETRIES,
                shouldRetry = ::shouldRetryProvider
            )
        )
    }

    private fun validateTranscriptionConfig(settings: AppSettings) {
        if (settings.apiKey.isBlank()) throw ProviderError.NoAPIKey()
        try {
            URL(settings.apiBaseUrl)
        } catch (_: Exception) {
            throw ProviderError.InvalidURL()
        }
    }
}

@Singleton
class LlmService @Inject constructor(
    private val llmApi: LlmApi,
    private val gson: Gson
) {
    companion object {
        private const val TAG = "LlmService"
    }
    suspend fun processText(text: String, settings: AppSettings): String {
        validateLlmConfig(settings)

        val request = buildRequest(text, settings, stream = false)
        val url = "${settings.effectiveLlmApiBaseUrl}/chat/completions"

        return retryWithBackoff(
            block = {
                val response = llmApi.chatCompletion(
                    url = url,
                    request = request
                )

                if (!response.isSuccessful) {
                    val errorBody = response.errorBody()?.string() ?: response.message()
                    throw ProviderError.ApiError(response.code(), errorBody)
                }

                response.body()?.choices?.firstOrNull()?.message?.content
                    ?: throw ProviderError.DecodingError("Empty LLM response")
            },
            options = RetryOptions(
                maxRetries = AppConstants.MAX_RETRIES,
                shouldRetry = ::shouldRetryProvider
            )
        )
    }

    fun processTextStream(text: String, settings: AppSettings): Flow<LLMStreamToken> {
        validateLlmConfig(settings)

        val request = buildRequest(text, settings, stream = true)
        val url = "${settings.effectiveLlmApiBaseUrl}/chat/completions"

        return flow {
            val responseBody = retryWithBackoff(
                block = {
                    val response = llmApi.chatCompletionStream(
                        url = url,
                        request = request
                    )

                    if (!response.isSuccessful) {
                        val errorBody = response.errorBody()?.string() ?: response.message()
                        throw ProviderError.ApiError(response.code(), errorBody)
                    }

                    response.body()
                        ?: throw ProviderError.DecodingError("Empty response body")
                },
                options = RetryOptions(
                    maxRetries = AppConstants.MAX_RETRIES,
                    shouldRetry = ::shouldRetryProvider
                )
            )

            responseBody.use { body ->
                val source = body.source()

                try {
                    while (currentCoroutineContext().isActive) {
                        val line = withTimeout(AppConstants.LLM_TIMEOUT_MS) {
                            if (source.exhausted()) null else source.readUtf8Line()
                        } ?: break

                        if (line.startsWith(":")) continue
                        if (line.isBlank()) continue
                        if (line == "data: [DONE]") break
                        if (!line.startsWith("data: ")) continue

                        val json = line.removePrefix("data: ")
                        try {
                            val chunk = gson.fromJson(json, StreamChunk::class.java)
                            chunk.choices?.firstOrNull()?.delta?.let { delta ->
                                val reasoning = delta.reasoningContent ?: delta.reasoning
                                if (!reasoning.isNullOrBlank()) {
                                    emit(LLMStreamToken.Reasoning(reasoning))
                                }
                                if (!delta.content.isNullOrBlank()) {
                                    emit(LLMStreamToken.Content(delta.content))
                                }
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "Failed to parse SSE chunk: ${sanitizeSsePayload(json)}", e)
                        }
                    }
                } catch (e: TimeoutCancellationException) {
                    throw ProviderError.NetworkError(
                        "LLM stream idle timeout after ${AppConstants.LLM_TIMEOUT_MS}ms"
                    )
                } catch (e: IOException) {
                    throw ProviderError.NetworkError(
                        "LLM stream interrupted: ${e.message ?: "unknown I/O error"}"
                    )
                }
            }
        }.flowOn(Dispatchers.IO)
    }

    private fun validateLlmConfig(settings: AppSettings) {
        if (settings.effectiveLlmApiKey.isBlank()) throw ProviderError.NoAPIKey()
        try {
            URL(settings.effectiveLlmApiBaseUrl)
        } catch (_: Exception) {
            throw ProviderError.InvalidURL()
        }
    }

    private fun buildRequest(
        text: String,
        settings: AppSettings,
        stream: Boolean
    ): ChatCompletionRequest {
        return ChatCompletionRequest(
            model = settings.llmModelName,
            messages = listOf(
                ChatMessage(role = "system", content = settings.llmSystemPrompt),
                ChatMessage(role = "user", content = "<transcription>\n$text\n</transcription>")
            ),
            stream = stream
        )
    }

    private fun sanitizeSsePayload(payload: String): String {
        val maxLength = 50
        val normalized = payload.replace('\n', ' ').replace('\r', ' ')
        val preview = normalized.take(maxLength)
        return if (normalized.length > maxLength) {
            "len=${normalized.length}, preview=${preview}..."
        } else {
            "len=${normalized.length}, preview=${preview}"
        }
    }
}

private data class TranscriptionResult(val text: String?)

private data class StreamChunk(
    val choices: List<StreamChoice>?
)

private data class StreamChoice(
    val delta: ChatDelta?
)

private fun shouldRetryProvider(error: Throwable, statusCode: Int?): Boolean {
    if (error is ProviderError.NoAPIKey ||
        error is ProviderError.InvalidURL ||
        error is ProviderError.DecodingError
    ) return false
    if (error is ProviderError.ApiError) {
        val code = error.statusCode
        if (code in 400..499 && code != 408 && code != 429) return false
    }
    return defaultShouldRetry(error, statusCode)
}
