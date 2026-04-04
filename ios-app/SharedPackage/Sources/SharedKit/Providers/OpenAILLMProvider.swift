import Foundation

public final class OpenAILLMProvider: LLMProvider, Sendable {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func process(text: String, settings: LLMSettings) async throws -> String {
        guard !settings.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ProviderError.noAPIKey
        }

        let baseURL = settings.apiBaseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(baseURL)/chat/completions") else {
            throw ProviderError.invalidURL
        }

        var messages: [[String: String]] = []
        let systemPrompt = settings.systemPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        if !systemPrompt.isEmpty {
            messages.append(["role": "system", "content": systemPrompt])
        }
        messages.append(["role": "user", "content": "<transcription>\(text)</transcription>"])

        let requestBody: [String: Any] = [
            "model": settings.modelName,
            "messages": messages
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: requestBody)

        return try await RetryService.retryWithBackoff {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(settings.apiKey)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = jsonData
            request.timeoutInterval = AppConstants.llmTimeoutMs / 1000

            let (data, response) = try await self.session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw ProviderError.networkError("Invalid response")
            }

            if httpResponse.statusCode == 200 {
                guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let choices = json["choices"] as? [[String: Any]],
                      let firstChoice = choices.first,
                      let message = firstChoice["message"] as? [String: Any],
                      let content = message["content"] as? String else {
                    throw ProviderError.decodingError("Failed to parse LLM response")
                }
                return content.trimmingCharacters(in: .whitespacesAndNewlines)
            }

            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ProviderError.apiError(statusCode: httpResponse.statusCode, message: errorBody)
        }
    }

    public func processStream(text: String, settings: LLMSettings) -> AsyncThrowingStream<LLMStreamToken, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    guard !settings.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        continuation.finish(throwing: ProviderError.noAPIKey)
                        return
                    }

                    let baseURL = settings.apiBaseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                    guard let url = URL(string: "\(baseURL)/chat/completions") else {
                        continuation.finish(throwing: ProviderError.invalidURL)
                        return
                    }

                    var messages: [[String: String]] = []
                    let systemPrompt = settings.systemPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !systemPrompt.isEmpty {
                        messages.append(["role": "system", "content": systemPrompt])
                    }
                    messages.append(["role": "user", "content": "<transcription>\(text)</transcription>"])

                    let requestBody: [String: Any] = [
                        "model": settings.modelName,
                        "messages": messages,
                        "stream": true
                    ]

                    let jsonData = try JSONSerialization.data(withJSONObject: requestBody)

                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("Bearer \(settings.apiKey)", forHTTPHeaderField: "Authorization")
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.httpBody = jsonData
                    request.timeoutInterval = AppConstants.llmTimeoutMs / 1000

                    let (bytes, response) = try await URLSession.shared.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.finish(throwing: ProviderError.networkError("Invalid response"))
                        return
                    }

                    if httpResponse.statusCode != 200 {
                        var errorBody = ""
                        for try await line in bytes {
                            errorBody += line
                        }
                        continuation.finish(throwing: ProviderError.apiError(
                            statusCode: httpResponse.statusCode,
                            message: errorBody
                        ))
                        return
                    }

                    for try await line in bytes {
                        let trimmed = line.trimmingCharacters(in: .whitespaces)
                        if trimmed.isEmpty || trimmed.hasPrefix(":") { continue }
                        if trimmed == "data: [DONE]" { continue }
                        guard trimmed.hasPrefix("data: ") else { continue }

                        let jsonString = String(trimmed.dropFirst(6))
                        guard let jsonData = jsonString.data(using: .utf8),
                              let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                              let choices = json["choices"] as? [[String: Any]],
                              let firstChoice = choices.first,
                              let delta = firstChoice["delta"] as? [String: Any] else { continue }

                        if let reasoning = delta["reasoning_content"] as? String ?? delta["reasoning"] as? String,
                           !reasoning.isEmpty {
                            continuation.yield(.reasoning(reasoning))
                        }

                        if let content = delta["content"] as? String, !content.isEmpty {
                            continuation.yield(.content(content))
                        }
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}
