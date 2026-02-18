// Copyright (c) 2026 Roman Barinov. MIT License.

import Foundation

enum TranscriptionError: LocalizedError {
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
        case .decodingError: return "Failed to parse API response."
        }
    }
}

class TranscriptionService {
    static let shared = TranscriptionService()

    private struct WhisperResponse: Decodable {
        let text: String
    }

    private let maxRetries = 3
    private let retryDelays: [UInt64] = [500_000_000, 1_500_000_000, 3_000_000_000] // 0.5s, 1.5s, 3s

    func transcribe(audioFileURL: URL) async throws -> String {
        let settings = AppSettings.shared

        guard !settings.apiKey.isEmpty else { throw TranscriptionError.noAPIKey }

        let baseURL = settings.apiBaseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(baseURL)/v1/audio/transcriptions") else {
            throw TranscriptionError.invalidURL
        }

        let audioData = try Data(contentsOf: audioFileURL)
        let boundary = "Boundary-\(UUID().uuidString)"

        var body = Data()
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"model\"\r\n\r\n")
        body.appendString("\(settings.modelName)\r\n")
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"response_format\"\r\n\r\n")
        body.appendString("json\r\n")

        // Language hint (ISO-639-1 code, e.g. "en", "ru", "de")
        let lang = settings.language.trimmingCharacters(in: .whitespaces)
        if !lang.isEmpty {
            body.appendString("--\(boundary)\r\n")
            body.appendString("Content-Disposition: form-data; name=\"language\"\r\n\r\n")
            body.appendString("\(lang)\r\n")
        }

        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n")
        body.appendString("Content-Type: audio/wav\r\n\r\n")
        body.append(audioData)
        body.appendString("\r\n")
        body.appendString("--\(boundary)--\r\n")

        var lastError: Error = TranscriptionError.networkError(
            NSError(domain: "WhisperApp", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unknown error"])
        )

        for attempt in 0..<maxRetries {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(settings.apiKey)", forHTTPHeaderField: "Authorization")
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 60
            request.httpBody = body

            do {
                let (data, response) = try await URLSession.shared.data(for: request)

                if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        guard let result = try? JSONDecoder().decode(WhisperResponse.self, from: data) else {
                            throw TranscriptionError.decodingError
                        }
                        try? FileManager.default.removeItem(at: audioFileURL)
                        return result.text
                    }

                    let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                    let apiErr = TranscriptionError.apiError("HTTP \(httpResponse.statusCode): \(errorBody)")

                    // Don't retry client errors (4xx) except 408/429
                    if httpResponse.statusCode >= 400 && httpResponse.statusCode < 500
                        && httpResponse.statusCode != 408 && httpResponse.statusCode != 429 {
                        throw apiErr
                    }
                    lastError = apiErr
                }
            } catch let error as TranscriptionError {
                // Non-retryable errors: no API key, invalid URL, decoding, 4xx client errors
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
                lastError = TranscriptionError.networkError(error)
            }

            // Wait before retrying (unless last attempt)
            if attempt < maxRetries - 1 {
                try? await Task.sleep(nanoseconds: retryDelays[attempt])
            }
        }

        // All retries exhausted
        try? FileManager.default.removeItem(at: audioFileURL)
        throw lastError
    }
}

private extension Data {
    mutating func appendString(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}
