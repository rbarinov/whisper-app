package com.whisperapp.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ChatMessage(
    @SerializedName("role") val role: String,
    @SerializedName("content") val content: String
)

data class ChatCompletionRequest(
    @SerializedName("model") val model: String,
    @SerializedName("messages") val messages: List<ChatMessage>,
    @SerializedName("stream") val stream: Boolean = false
)

data class ChatCompletionResponse(
    @SerializedName("choices") val choices: List<ChatChoice>
)

data class ChatChoice(
    @SerializedName("message") val message: ChatMessage? = null,
    @SerializedName("delta") val delta: ChatDelta? = null
)

data class ChatDelta(
    @SerializedName("content") val content: String? = null
)

data class LlmStreamChunk(
    @SerializedName("choices") val choices: List<ChatChoice> = emptyList()
)
