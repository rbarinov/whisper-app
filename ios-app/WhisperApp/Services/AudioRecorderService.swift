import Foundation
import AVFoundation

struct RecordingResult {
    let fileURL: URL
    let duration: TimeInterval
    let wavData: Data
}

final class AudioRecorderService {
    private let targetSampleRate: Double = 16000
    private let channels: UInt32 = 1
    private let bitsPerSample: UInt32 = 16

    private var engine: AVAudioEngine?
    private var sampleBuffers: [Float] = []
    private var inputSampleRate: Double = 0
    private var recordingStartTime: Date?
    private var isRecording = false

    var currentDuration: TimeInterval {
        guard let start = recordingStartTime else { return 0 }
        return Date().timeIntervalSince(start)
    }

    func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func startRecording() throws {
        guard !isRecording else { return }

        let engine = AVAudioEngine()
        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        guard let pcmFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: format.sampleRate,
            channels: 1,
            interleaved: false
        ) else {
            throw AudioRecorderError.formatError
        }

        sampleBuffers = []
        inputSampleRate = format.sampleRate
        recordingStartTime = Date()

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: pcmFormat) { [weak self] buffer, _ in
            guard let self else { return }
            let channelData = buffer.floatChannelData?[0]
            let frameLength = Int(buffer.frameLength)
            guard let data = channelData, frameLength > 0 else { return }
            self.sampleBuffers.append(contentsOf: UnsafeBufferPointer(start: data, count: frameLength))
        }

        try engine.start()
        self.engine = engine
        isRecording = true
    }

    func stopRecording() -> RecordingResult? {
        guard isRecording else { return nil }

        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop()
        engine = nil
        isRecording = false

        let duration = recordingStartTime.map { Date().timeIntervalSince($0) } ?? 0
        recordingStartTime = nil

        guard !sampleBuffers.isEmpty else { return nil }

        let samples = sampleBuffers
        sampleBuffers = []

        let resampled = resampleTo16kHz(samples, inputSampleRate: inputSampleRate)
        let wavData = encodeWAV(resampled)

        let fileName = "recording-\(Int(Date().timeIntervalSince1970 * 1000)).wav"
        let recordingsDir = Self.recordingsDirectory()
        let fileURL = recordingsDir.appendingPathComponent(fileName)

        do {
            try FileManager.default.createDirectory(at: recordingsDir, withIntermediateDirectories: true)
            try wavData.write(to: fileURL)
        } catch {
            return nil
        }

        let resampledCount = resampled.count
        let actualDuration = Double(resampledCount) / targetSampleRate

        return RecordingResult(
            fileURL: fileURL,
            duration: actualDuration > 0 ? actualDuration : duration,
            wavData: wavData
        )
    }

    func cancel() {
        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop()
        engine = nil
        isRecording = false
        recordingStartTime = nil
        sampleBuffers = []
    }

    static func recordingsDirectory() -> URL {
        let appGroupURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: AppConstants.appGroupIdentifier
        )!
        return appGroupURL.appendingPathComponent("recordings")
    }

    private func resampleTo16kHz(_ samples: [Float], inputSampleRate: Double) -> [Float] {
        guard inputSampleRate > 0, !samples.isEmpty else { return [] }
        if inputSampleRate == targetSampleRate { return samples }

        let ratio = inputSampleRate / targetSampleRate
        let outputLength = max(1, Int(Double(samples.count) / ratio))
        var output = [Float](repeating: 0, count: outputLength)

        for i in 0..<outputLength {
            let sourcePosition = Double(i) * ratio
            let leftIndex = Int(sourcePosition)
            let rightIndex = min(leftIndex + 1, samples.count - 1)
            let interpolation = Float(sourcePosition - Double(leftIndex))

            output[i] = samples[leftIndex] + (samples[rightIndex] - samples[leftIndex]) * interpolation
        }

        return output
    }

    private func encodeWAV(_ samples: [Float]) -> Data {
        let dataLength = samples.count * 2
        let byteRate = UInt32(targetSampleRate) * channels * (bitsPerSample / 8)
        let blockAlign = channels * (bitsPerSample / 8)
        let chunkSize = UInt32(36 + dataLength)

        var header = Data(capacity: 44)
        header.append(contentsOf: [0x52, 0x49, 0x46, 0x46])
        header.append(contentsOf: withUnsafeBytes(of: chunkSize.littleEndian) { Array($0) })
        header.append(contentsOf: [0x57, 0x41, 0x56, 0x45])
        header.append(contentsOf: [0x66, 0x6D, 0x74, 0x20])
        header.append(contentsOf: withUnsafeBytes(of: UInt32(16).littleEndian) { Array($0) })
        header.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian) { Array($0) })
        header.append(contentsOf: withUnsafeBytes(of: channels.littleEndian) { Array($0) })
        header.append(contentsOf: withUnsafeBytes(of: UInt32(targetSampleRate).littleEndian) { Array($0) })
        header.append(contentsOf: withUnsafeBytes(of: byteRate.littleEndian) { Array($0) })
        header.append(contentsOf: withUnsafeBytes(of: blockAlign.littleEndian) { Array($0) })
        header.append(contentsOf: withUnsafeBytes(of: bitsPerSample.littleEndian) { Array($0) })
        header.append(contentsOf: [0x64, 0x61, 0x74, 0x61])
        header.append(contentsOf: withUnsafeBytes(of: UInt32(dataLength).littleEndian) { Array($0) })

        var pcmData = Data(capacity: dataLength)
        pcmData.reserveCapacity(dataLength)
        for sample in samples {
            let clamped = max(-1.0, min(1.0, sample))
            let int16: Int16 = clamped < 0
                ? Int16(clamped * 32768.0)
                : Int16(clamped * 32767.0)
            pcmData.append(contentsOf: withUnsafeBytes(of: int16.littleEndian) { Array($0) })
        }

        return header + pcmData
    }
}

enum AudioRecorderError: Error, LocalizedError {
    case formatError
    case notRecording
    case permissionDenied

    var errorDescription: String? {
        switch self {
        case .formatError:
            return "Could not create audio format"
        case .notRecording:
            return "No recording in progress"
        case .permissionDenied:
            return "Microphone permission denied"
        }
    }
}
