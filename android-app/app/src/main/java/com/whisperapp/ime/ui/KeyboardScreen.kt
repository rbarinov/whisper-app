package com.whisperapp.ime.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.whisperapp.domain.model.KeyboardState
import com.whisperapp.ime.KeyboardViewModel

@Composable
fun KeyboardScreen(
    viewModel: KeyboardViewModel,
    onSwitchToNextKeyboard: () -> Unit,
    onInsertText: (String) -> Unit = {}
) {
    val state = viewModel.keyboardState
    val resultText = viewModel.resultText
    val errorMessage = viewModel.errorMessage
    val processingText = viewModel.processingText.collectAsState()

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 3.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            StatusHeader(state)

            when (state) {
                KeyboardState.IDLE -> {
                    RecordButton(onClick = { viewModel.startRecording() })
                }

                KeyboardState.RECORDING -> {
                    RecordingIndicator()
                    Spacer(modifier = Modifier.height(4.dp))
                    StopButton(onClick = { viewModel.stopRecording() })
                    Spacer(modifier = Modifier.height(4.dp))
                    CancelButton(onClick = { viewModel.cancelRecording() })
                }

                KeyboardState.TRANSCRIBING -> {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp))
                    Text(
                        text = "Transcribing...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    CancelButton(onClick = { viewModel.cancelRecording() })
                }

                KeyboardState.PROCESSING -> {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp))
                    Text(
                        text = "Processing...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                KeyboardState.RESULT_READY -> {
                    ResultPreview(resultText)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        InsertButton(onClick = { onInsertText(resultText) })
                        ClearButton(onClick = { viewModel.clearResult() })
                    }
                }

                KeyboardState.ERROR -> {
                    ErrorDisplay(errorMessage)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        RetryButton(onClick = {
                            viewModel.clearResult()
                            viewModel.startRecording()
                        })
                        ClearButton(onClick = { viewModel.clearResult() })
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f, fill = false))

            SwitchKeyboardButton(onClick = onSwitchToNextKeyboard)
        }
    }
}

@Composable
private fun StatusHeader(state: KeyboardState) {
    val statusText = when (state) {
        KeyboardState.IDLE -> "Whisper Voice Keyboard"
        KeyboardState.RECORDING -> "Recording..."
        KeyboardState.TRANSCRIBING -> "Transcribing audio..."
        KeyboardState.PROCESSING -> "AI processing..."
        KeyboardState.RESULT_READY -> "Transcription ready"
        KeyboardState.ERROR -> "Error"
    }

    val statusColor by animateColorAsState(
        targetValue = when (state) {
            KeyboardState.RECORDING -> MaterialTheme.colorScheme.error
            KeyboardState.RESULT_READY -> MaterialTheme.colorScheme.primary
            KeyboardState.ERROR -> MaterialTheme.colorScheme.error
            else -> MaterialTheme.colorScheme.onSurfaceVariant
        },
        label = "statusColor"
    )

    Text(
        text = statusText,
        style = MaterialTheme.typography.labelMedium,
        color = statusColor,
        textAlign = TextAlign.Center
    )
}

@Composable
private fun RecordButton(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.size(64.dp),
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        Icon(
            imageVector = Icons.Default.Mic,
            contentDescription = "Start Recording",
            modifier = Modifier.size(32.dp),
            tint = MaterialTheme.colorScheme.onPrimary
        )
    }
}

@Composable
private fun RecordingIndicator() {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(500),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    Box(
        modifier = Modifier
            .size(48.dp)
            .scale(scale)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.error),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.Mic,
            contentDescription = "Recording",
            modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.onError
        )
    }
}

@Composable
private fun StopButton(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.error
        )
    ) {
        Icon(
            imageVector = Icons.Default.Stop,
            contentDescription = "Stop Recording",
            modifier = Modifier.size(32.dp),
            tint = MaterialTheme.colorScheme.onError
        )
    }
}

@Composable
private fun CancelButton(onClick: () -> Unit) {
    OutlinedButton(onClick = onClick) {
        Icon(
            imageVector = Icons.Default.Cancel,
            contentDescription = "Cancel",
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text("Cancel")
    }
}

@Composable
private fun InsertButton(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        Icon(
            imageVector = Icons.Default.ContentCopy,
            contentDescription = "Insert Text",
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text("Insert")
    }
}

@Composable
private fun ClearButton(onClick: () -> Unit) {
    OutlinedButton(onClick = onClick) {
        Icon(
            imageVector = Icons.Default.Cancel,
            contentDescription = "Clear",
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text("Clear")
    }
}

@Composable
private fun RetryButton(onClick: () -> Unit) {
    Button(onClick = onClick) {
        Icon(
            imageVector = Icons.Default.Mic,
            contentDescription = "Retry",
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text("Retry")
    }
}

@Composable
private fun ResultPreview(text: String) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Text(
            text = text,
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun ErrorDisplay(message: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.errorContainer
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(12.dp),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onErrorContainer
        )
    }
}

@Composable
private fun SwitchKeyboardButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(
            imageVector = Icons.Default.Keyboard,
            contentDescription = "Switch to next keyboard",
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
