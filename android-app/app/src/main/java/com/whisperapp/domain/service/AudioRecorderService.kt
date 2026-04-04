package com.whisperapp.domain.service

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.whisperapp.util.AudioUtils
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.concurrent.thread

@Singleton
class AudioRecorderService @Inject constructor(
    @ApplicationContext private val context: Context
) {
    @Volatile
    private var audioRecord: AudioRecord? = null

    @Volatile
    private var isRecording = false

    private var recordingThread: Thread? = null
    private var pcmOutputStream = ByteArrayOutputStream()
    private var startTimeMs = 0L

    val isCurrentlyRecording: Boolean get() = isRecording

    @Synchronized
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
        )

        pcmOutputStream = ByteArrayOutputStream()
        startTimeMs = System.currentTimeMillis()
        isRecording = true

        audioRecord!!.startRecording()

        recordingThread = thread(name = "AudioRecorder") {
            val buffer = ByteArray(bufferSize)
            while (isRecording) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                if (read > 0) {
                    synchronized(pcmOutputStream) {
                        pcmOutputStream.write(buffer, 0, read)
                    }
                }
            }
        }
    }

    @Synchronized
    fun stopRecording(): File? {
        if (!isRecording) return null

        isRecording = false
        recordingThread?.join(2000)
        recordingThread = null

        try {
            audioRecord?.stop()
        } catch (_: IllegalStateException) {
        }
        audioRecord?.release()
        audioRecord = null

        synchronized(pcmOutputStream) {
            if (pcmOutputStream.size() == 0) return null
        }

        return withContext(Dispatchers.IO) {
            val recordingsDir = File(context.filesDir, "recordings")
            recordingsDir.mkdirs()
            val wavFile = File(recordingsDir, "recording_${System.currentTimeMillis()}.wav")

            synchronized(pcmOutputStream) {
                val pcmArray = pcmOutputStream.toByteArray()
                pcmOutputStream.reset()
                AudioUtils.writeWavFile(wavFile, pcmArray, 16000, 1, 16)
            }

            wavFile
        }
    }

    fun getRecordingDurationSeconds(): Double {
        val elapsed = System.currentTimeMillis() - startTimeMs
        return elapsed / 1000.0
    }

    @Synchronized
    fun cancelRecording() {
        if (!isRecording) return

        isRecording = false
        recordingThread?.join(2000)
        recordingThread = null

        try {
            audioRecord?.stop()
        } catch (_: IllegalStateException) {
        }
        audioRecord?.release()
        audioRecord = null

        synchronized(pcmOutputStream) {
            pcmOutputStream.reset()
        }
    }
}
