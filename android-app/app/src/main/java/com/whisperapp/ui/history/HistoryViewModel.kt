package com.whisperapp.ui.history

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
class HistoryViewModel @Inject constructor(
    private val transcriptionRepository: TranscriptionRepository
) : ViewModel() {

    val entries: StateFlow<List<TranscriptionEntry>> = transcriptionRepository.getAllEntries()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun deleteEntry(id: String) {
        viewModelScope.launch {
            transcriptionRepository.deleteEntry(id)
        }
    }

    fun clearAll() {
        viewModelScope.launch {
            transcriptionRepository.deleteAllEntries()
        }
    }
}
