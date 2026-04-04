package com.whisperapp.domain.service

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.whisperapp.util.AudioUtils
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AudioRecorderService @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var recordingThread: Thread? = null
    private var pcmData = mutableListOf<Byte>()

    val isCurrentlyRecording: Boolean get() = isRecording

    fun startRecording() {
        if (isRecording) return

        val sampleRate = 16000
        val channelConfig = AudioFormat.CHANNEL_IN_MONO
        val audioFormat = AudioFormat.ENCODING_PCM_16BIT
        val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            channelConfig,
            audioFormat,
            bufferSize
        ).also {
            it.startRecording()
        }

        isRecording = true
        pcmData = mutableListOf()

        recordingThread = Thread {
            val buffer = ByteArray(bufferSize)
            while (isRecording) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                if (read > 0) {
                    synchronized(pcmData) {
                        for (i in 0 until read) {
                            pcmData.add(buffer[i])
                        }
                    }
                }
            }
        }.also { it.start() }
    }

    fun stopRecording(): File? {
        isRecording = false
        recordingThread?.join(2000)
        recordingThread = null
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null

        if (pcmData.isEmpty()) return null

        return withContext(Dispatchers.IO) {
            val recordingsDir = File(context.filesDir, "recordings")
            recordingsDir.mkdirs()
            val wavFile = File(recordingsDir, "recording_${System.currentTimeMillis()}.wav")

            synchronized(pcmData) {
                val pcmArray = pcmData.toByteArray()
                pcmData.clear()
                AudioUtils.writeWavFile(wavFile, pcmArray, 16000, 1, 16)
            }

            wavFile
        }
    }

    fun getRecordingDurationSeconds(): Double {
        synchronized(pcmData) {
            val bytesPerSecond = 16000 * 1 * 2
            return pcmData.size.toDouble() / bytesPerSecond
        }
    }

    fun cancelRecording() {
        isRecording = false
        recordingThread?.join(2000)
        recordingThread = null
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        pcmData.clear()
    }
}
