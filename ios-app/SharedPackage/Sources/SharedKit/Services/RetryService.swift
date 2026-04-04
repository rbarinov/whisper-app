import Foundation

public enum RetryService {
    public static func retryWithBackoff<T: Sendable>(
        maxRetries: Int = AppConstants.maxRetries,
        delays: [TimeInterval] = AppConstants.retryDelaysMs,
        operation: @Sendable () async throws -> T
    ) async throws -> T {
        var lastError: Error?

        for attempt in 0..<maxRetries {
            do {
                return try await operation()
            } catch {
                if !shouldRetry(error) {
                    throw error
                }
                lastError = error

                if attempt < maxRetries - 1 {
                    let delay = delays[attempt] ?? delays.last ?? 3000
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000))
                }
            }
        }

        throw lastError!
    }

    public static func shouldRetry(_ error: Error) -> Bool {
        guard let providerError = error as? ProviderError else {
            return true
        }

        switch providerError {
        case .noAPIKey, .invalidURL, .decodingError:
            return false
        case .apiError(let statusCode, _):
            if statusCode >= 500 { return true }
            if statusCode == 408 || statusCode == 429 { return true }
            if statusCode >= 400 && statusCode < 500 { return false }
            return true
        case .networkError:
            return true
        }
    }
}
