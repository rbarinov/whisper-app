package com.whisperapp.util

import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream

object AudioUtils {
    fun writeWavFile(file: File, pcmData: ByteArray, sampleRate: Int, channels: Int, bitsPerSample: Int) {
        FileOutputStream(file).use { fos ->
            DataOutputStream(fos).use { dos ->
                val byteRate = sampleRate * channels * bitsPerSample / 8
                val blockAlign = channels * bitsPerSample / 8
                val dataSize = pcmData.size

                dos.writeBytes("RIFF")
                dos.writeInt(36 + dataSize)
                dos.writeBytes("WAVE")

                dos.writeBytes("fmt ")
                dos.writeInt(16)
                dos.writeShort(1)
                dos.writeShort(channels)
                dos.writeInt(sampleRate)
                dos.writeInt(byteRate)
                dos.writeShort(blockAlign)
                dos.writeShort(bitsPerSample)

                dos.writeBytes("data")
                dos.writeInt(dataSize)

                dos.write(pcmData, 0, dataSize)
            }
        }
    }

    fun resampleTo16k(pcmData: ByteArray, sourceSampleRate: Int): ByteArray {
        if (sourceSampleRate == 16000) return pcmData

        val ratio = sourceSampleRate.toDouble() / 16000.0
        val targetLength = (pcmData.size / 2.0 / ratio).toInt()
        val result = ByteArray(targetLength * 2)

        for (i in 0 until targetLength) {
            val sourceIndex = (i * ratio).toInt() * 2
            if (sourceIndex + 1 < pcmData.size) {
                result[i * 2] = pcmData[sourceIndex]
                result[i * 2 + 1] = pcmData[sourceIndex + 1]
            }
        }

        return result
    }
}
