import Foundation

public final class OpenAITranscriptionProvider: TranscriptionProvider, Sendable {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func transcribe(audioData: Data, settings: TranscriptionSettings) async throws -> String {
        guard !settings.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ProviderError.noAPIKey
        }

        let baseURL = settings.apiBaseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(baseURL)/audio/transcriptions") else {
            throw ProviderError.invalidURL
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        let body = buildMultipartBody(boundary: boundary, settings: settings, audioData: audioData)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(settings.apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        request.timeoutInterval = AppConstants.whisperTimeoutMs / 1000

        let finalRequest = request
        return try await RetryService.retryWithBackoff {
            let (data, response) = try await self.session.data(for: finalRequest)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw ProviderError.networkError("Invalid response")
            }

            if httpResponse.statusCode == 200 {
                guard let result = try? JSONDecoder().decode(TranscriptionResult.self, from: data) else {
                    throw ProviderError.decodingError("Failed to parse transcription response")
                }
                return result.text
            }

            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ProviderError.apiError(statusCode: httpResponse.statusCode, message: errorBody)
        }
    }

    private func buildMultipartBody(boundary: String, settings: TranscriptionSettings, audioData: Data) -> Data {
        var body = Data()

        body.appendMultipart("--\(boundary)\r\n")
        body.appendMultipart("Content-Disposition: form-data; name=\"model\"\r\n\r\n")
        body.appendMultipart("\(settings.modelName)\r\n")

        body.appendMultipart("--\(boundary)\r\n")
        body.appendMultipart("Content-Disposition: form-data; name=\"response_format\"\r\n\r\n")
        body.appendMultipart("json\r\n")

        let lang = settings.language.trimmingCharacters(in: .whitespaces)
        if !lang.isEmpty {
            body.appendMultipart("--\(boundary)\r\n")
            body.appendMultipart("Content-Disposition: form-data; name=\"language\"\r\n\r\n")
            body.appendMultipart("\(lang)\r\n")
        }

        body.appendMultipart("--\(boundary)\r\n")
        body.appendMultipart("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n")
        body.appendMultipart("Content-Type: audio/wav\r\n\r\n")
        body.append(audioData)
        body.appendMultipart("\r\n")

        body.appendMultipart("--\(boundary)--\r\n")

        return body
    }
}

private struct TranscriptionResult: Decodable {
    let text: String
}

private extension Data {
    mutating func appendMultipart(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}
