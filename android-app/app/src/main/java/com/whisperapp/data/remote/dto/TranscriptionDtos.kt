package com.whisperapp.data.remote.dto

import com.google.gson.annotations.SerializedName

data class TranscriptionRequest(
    @SerializedName("model") val model: String,
    @SerializedName("response_format") val responseFormat: String = "json",
    @SerializedName("language") val language: String? = null
)

data class TranscriptionResponse(
    @SerializedName("text") val text: String
)
