package com.whisperapp.data.provider

sealed class ProviderError(message: String, cause: Throwable? = null) : Exception(message, cause) {
    class NoAPIKey : ProviderError("API key is not configured. Open Settings to set it.")
    class InvalidURL : ProviderError("Invalid API base URL. Check Settings.")
    class NetworkError(detail: String) : ProviderError("Network error: $detail")
    class ApiError(val statusCode: Int, detail: String) : ProviderError("API error: HTTP $statusCode: $detail")
    class DecodingError(detail: String) : ProviderError("Failed to parse response: $detail")
}
