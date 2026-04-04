package com.whisperapp.data.remote

import com.whisperapp.data.remote.dto.ChatCompletionRequest
import com.whisperapp.data.remote.dto.ChatCompletionResponse
import com.whisperapp.data.remote.dto.TranscriptionResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Streaming
import retrofit2.http.Url

interface WhisperApi {
    @Multipart
    @POST
    suspend fun transcribe(
        @Url url: String,
        @Part file: MultipartBody.Part,
        @Part("model") model: RequestBody,
        @Part("response_format") responseFormat: RequestBody,
        @Part("language") language: RequestBody?
    ): TranscriptionResponse

    @Streaming
    @POST
    suspend fun transcribeRaw(
        @Url url: String,
        @Part file: MultipartBody.Part,
        @Part("model") model: RequestBody,
        @Part("response_format") responseFormat: RequestBody,
        @Part("language") language: RequestBody?
    ): Response<ResponseBody>
}

interface LlmApi {
    @Streaming
    @POST
    suspend fun chatCompletion(
        @Url url: String,
        @Body request: ChatCompletionRequest
    ): Response<ChatCompletionResponse>

    @Streaming
    @POST
    suspend fun chatCompletionStream(
        @Url url: String,
        @Body request: ChatCompletionRequest
    ): Response<ResponseBody>
}
