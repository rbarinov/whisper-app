// Copyright (c) 2026 Roman Barinov. MIT License.

import Foundation

enum LLMError: LocalizedError {
    case noAPIKey
    case invalidURL
    case networkError(Error)
    case apiError(String)
    case decodingError

    var errorDescription: String? {
        switch self {
        case .noAPIKey: return "API key is not configured. Open Settings to set it."
        case .invalidURL: return "Invalid API base URL. Check Settings."
        case .networkError(let error): return "Network error: \(error.localizedDescription)"
        case .apiError(let message): return "API error: \(message)"
        case .decodingError: return "Failed to parse LLM response."
        }
    }
}

class LLMService {
    static let shared = LLMService()

    private struct ChatCompletionResponse: Decodable {
        struct Choice: Decodable {
            struct Message: Decodable {
                let content: String
            }
            let message: Message
        }
        let choices: [Choice]
    }

    private let maxRetries = 3
    private let retryDelays: [UInt64] = [500_000_000, 1_500_000_000, 3_000_000_000] // 0.5s, 1.5s, 3s

    func process(text: String) async throws -> String {
        let settings = AppSettings.shared

        guard !settings.apiKey.isEmpty else { throw LLMError.noAPIKey }

        let baseURL = settings.apiBaseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(baseURL)/v1/chat/completions") else {
            throw LLMError.invalidURL
        }

        // Build messages array
        var messages: [[String: String]] = []
        let systemPrompt = settings.llmSystemPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        if !systemPrompt.isEmpty {
            messages.append(["role": "system", "content": systemPrompt])
        }
        // Wrap transcription in tags to clearly separate data from instructions
        messages.append(["role": "user", "content": "<transcription>\(text)</transcription>"])

        let requestBody: [String: Any] = [
            "model": settings.llmModelName,
            "messages": messages,
            "reasoning_effort": "low"
        ]

        guard let bodyData = try? JSONSerialization.data(withJSONObject: requestBody) else {
            throw LLMError.decodingError
        }

        var lastError: Error = LLMError.networkError(
            NSError(domain: "WhisperApp", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unknown error"])
        )

        for attempt in 0..<maxRetries {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(settings.apiKey)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 30
            request.httpBody = bodyData

            do {
                let (data, response) = try await URLSession.shared.data(for: request)

                if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        guard let result = try? JSONDecoder().decode(ChatCompletionResponse.self, from: data),
                              let content = result.choices.first?.message.content else {
                            throw LLMError.decodingError
                        }
                        return content.trimmingCharacters(in: .whitespacesAndNewlines)
                    }

                    let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                    let apiErr = LLMError.apiError("HTTP \(httpResponse.statusCode): \(errorBody)")

                    // Don't retry client errors (4xx) except 408/429
                    if httpResponse.statusCode >= 400 && httpResponse.statusCode < 500
                        && httpResponse.statusCode != 408 && httpResponse.statusCode != 429 {
                        throw apiErr
                    }
                    lastError = apiErr
                }
            } catch let error as LLMError {
                // Non-retryable errors
                switch error {
                case .noAPIKey, .invalidURL, .decodingError:
                    throw error
                case .apiError:
                    // 4xx already thrown above; if we get here it's a retryable apiError
                    lastError = error
                case .networkError:
                    lastError = error
                }
            } catch {
                lastError = LLMError.networkError(error)
            }

            // Wait before retrying (unless last attempt)
            if attempt < maxRetries - 1 {
                try? await Task.sleep(nanoseconds: retryDelays[attempt])
            }
        }

        // All retries exhausted
        throw lastError
    }
}
