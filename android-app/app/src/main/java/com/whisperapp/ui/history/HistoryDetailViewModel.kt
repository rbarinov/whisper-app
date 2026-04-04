package com.whisperapp.ui.history

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whisperapp.domain.model.TranscriptionEntry
import com.whisperapp.domain.repository.TranscriptionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HistoryDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val transcriptionRepository: TranscriptionRepository
) : ViewModel() {

    private val entryId: String = checkNotNull(savedStateHandle["entryId"])

    val entry: StateFlow<TranscriptionEntry?> = transcriptionRepository.getEntryFlow(entryId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    fun retryEntry() {
        viewModelScope.launch {
            transcriptionRepository.getEntry(entryId)?.let { existing ->
                transcriptionRepository.insertEntry(
                    existing.copy(status = com.whisperapp.domain.model.TranscriptionStatus.TRANSCRIBING)
                )
            }
        }
    }
}
