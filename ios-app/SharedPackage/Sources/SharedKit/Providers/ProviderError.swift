import Foundation

public enum ProviderError: Error, LocalizedError, Sendable {
    case noAPIKey
    case invalidURL
    case networkError(String)
    case apiError(statusCode: Int, message: String)
    case decodingError(String)

    public var errorDescription: String? {
        switch self {
        case .noAPIKey:
            return "API key is not configured. Open Settings to set it."
        case .invalidURL:
            return "Invalid API base URL. Check Settings."
        case .networkError(let message):
            return "Network error: \(message)"
        case .apiError(let statusCode, let message):
            return "API error: HTTP \(statusCode): \(message)"
        case .decodingError(let message):
            return "Failed to parse response: \(message)"
        }
    }

    public var statusCode: Int? {
        if case .apiError(let code, _) = self { return code }
        return nil
    }
}
