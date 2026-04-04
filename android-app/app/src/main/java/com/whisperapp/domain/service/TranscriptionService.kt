package com.whisperapp.domain.service

import com.whisperapp.domain.model.AppSettings
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import com.whisperapp.data.remote.LlmApi
import com.whisperapp.data.remote.WhisperApi
import com.whisperapp.data.remote.dto.ChatCompletionRequest
import com.whisperapp.data.remote.dto.ChatMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TranscriptionService @Inject constructor(
    private val whisperApi: WhisperApi
) {
    suspend fun transcribe(
        audioFile: File,
        settings: AppSettings
    ): String {
        val requestBody = audioFile.asRequestBody("audio/wav".toMediaType())
        val filePart = MultipartBody.Part.createFormData("file", audioFile.name, requestBody)

        return whisperApi.transcribe(
            url = "${settings.apiBaseUrl}/audio/transcriptions",
            file = filePart,
            model = settings.modelName.toRequestBody("text/plain".toMediaType()),
            responseFormat = "json".toRequestBody("text/plain".toMediaType()),
            language = settings.language.takeIf { it != "en" }?.toRequestBody("text/plain".toMediaType())
        ).text
    }
}

@Singleton
class LlmService @Inject constructor(
    private val llmApi: LlmApi
) {
    suspend fun processText(text: String, settings: AppSettings): String {
        val request = ChatCompletionRequest(
            model = settings.llmModelName,
            messages = listOf(
                ChatMessage(role = "system", content = settings.llmSystemPrompt),
                ChatMessage(role = "user", content = "<transcription>\n$text\n</transcription>")
            ),
            stream = false
        )

        val response = llmApi.chatCompletion(
            url = "${settings.effectiveLlmApiBaseUrl}/chat/completions",
            request = request
        )

        if (!response.isSuccessful) {
            throw RuntimeException("LLM API error: ${response.code()} ${response.message()}")
        }

        return response.body()?.choices?.firstOrNull()?.message?.content
            ?: throw RuntimeException("Empty LLM response")
    }

    fun processTextStream(text: String, settings: AppSettings) = flow<String> {
        val request = ChatCompletionRequest(
            model = settings.llmModelName,
            messages = listOf(
                ChatMessage(role = "system", content = settings.llmSystemPrompt),
                ChatMessage(role = "user", content = "<transcription>\n$text\n</transcription>")
            ),
            stream = true
        )

        val response = llmApi.chatCompletionStream(
            url = "${settings.effectiveLlmApiBaseUrl}/chat/completions",
            request = request
        )

        if (!response.isSuccessful) {
            throw RuntimeException("LLM API error: ${response.code()} ${response.message()}")
        }

        response.body()?.choices?.forEach { choice ->
            choice.delta?.content?.let { emit(it) }
        }
    }.flowOn(Dispatchers.IO)
}
