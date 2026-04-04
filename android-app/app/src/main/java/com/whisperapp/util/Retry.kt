package com.whisperapp.util

import android.util.Log
import com.whisperapp.util.AppConstants.MAX_RETRIES
import com.whisperapp.util.AppConstants.RETRY_DELAYS_MS
import retrofit2.HttpException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

data class RetryOptions(
    val maxRetries: Int = MAX_RETRIES,
    val delayMs: LongArray = RETRY_DELAYS_MS,
    val shouldRetry: (Throwable, Int?) -> Boolean = { error, statusCode ->
        defaultShouldRetry(error, statusCode)
    }
)

fun defaultShouldRetry(error: Throwable, statusCode: Int?): Boolean {
    if (error is SocketTimeoutException || error is UnknownHostException) return true
    if (statusCode == null) return true
    if (statusCode >= 500) return true
    if (statusCode == 408 || statusCode == 429) return true
    return false
}

suspend fun <T> retryWithBackoff(
    block: suspend () -> T,
    options: RetryOptions = RetryOptions()
): T {
    var lastError: Throwable? = null

    repeat(options.maxRetries) { attempt ->
        try {
            return block()
        } catch (e: Throwable) {
            val statusCode = extractStatusCode(e)

            if (!options.shouldRetry(e, statusCode)) {
                throw e
            }

            lastError = e
            val delay = options.delayMs.getOrElse(attempt) { options.delayMs.last() }
            Log.d(
                "Retry",
                "Attempt ${attempt + 1}/${options.maxRetries} failed: ${e.message}. " +
                    "Retrying in ${delay}ms..."
            )

            if (attempt < options.maxRetries - 1) {
                kotlinx.coroutines.delay(delay)
            }
        }
    }

    Log.w("Retry", "All ${options.maxRetries} attempts exhausted. Last error: ${lastError?.message}")
    throw lastError ?: RuntimeException("Retry exhausted without error")
}

private fun extractStatusCode(error: Throwable): Int? {
    if (error is HttpException) return error.code()
    return null
}
