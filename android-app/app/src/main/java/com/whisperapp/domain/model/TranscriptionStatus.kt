package com.whisperapp.domain.model

enum class TranscriptionStatus {
    RECORDING,
    TRANSCRIBING,
    PROCESSING,
    SUCCESSFUL,
    FAILED,
    CANCELLED
}
