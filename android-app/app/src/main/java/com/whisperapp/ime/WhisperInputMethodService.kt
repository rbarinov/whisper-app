package com.whisperapp.ime

import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.whisperapp.di.ImeServiceEntryPoint
import com.whisperapp.ime.ui.KeyboardScreen
import dagger.hilt.android.EntryPointAccessors

class WhisperInputMethodService : InputMethodService(), LifecycleOwner, ViewModelStoreOwner,
    SavedStateRegistryOwner {
    private val lifecycleRegistry = LifecycleRegistry(this)
    private val store = ViewModelStore()
    private val savedStateRegistryController = SavedStateRegistryController.create(this)

    override val lifecycle: Lifecycle get() = lifecycleRegistry
    override val viewModelStore: ViewModelStore get() = store
    override val savedStateRegistry: SavedStateRegistry
        get() = savedStateRegistryController.savedStateRegistry

    private val viewModel: KeyboardViewModel by lazy {
        val entryPoint = EntryPointAccessors.fromApplication(
            application, ImeServiceEntryPoint::class.java
        )
        ViewModelProvider(store, entryPoint.keyboardViewModelFactory())[KeyboardViewModel::class.java]
    }

    private var composeView: ComposeView? = null

    override fun onCreate() {
        super.onCreate()
        savedStateRegistryController.performRestore(null)
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
    }

    override fun onBindInput() {
        super.onBindInput()
        lifecycleRegistry.currentState = Lifecycle.State.STARTED
    }

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        viewModel.clearResult()
    }

    override fun onCreateInputView(): View {
        val container = ComposeView(this).also {
            it.setViewTreeLifecycleOwner(this)
            it.setViewTreeViewModelStoreOwner(this)
            it.setViewTreeSavedStateRegistryOwner(this)
        }

        container.setContent {
            MaterialTheme {
                KeyboardScreen(
                    viewModel = viewModel,
                    onSwitchToNextKeyboard = { switchToNextInputMethod(false) },
                    onInsertText = {
                        currentInputConnection?.commitText(it, 1)
                    }
                )
            }
        }

        composeView = container
        return container
    }

    override fun onWindowShown() {
        super.onWindowShown()
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        lifecycleRegistry.currentState = Lifecycle.State.STARTED
        if (viewModel.isRecordingActive) {
            viewModel.cancelRecording()
        }
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        composeView = null
    }

    override fun onDestroy() {
        super.onDestroy()
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        store.clear()
    }

    override fun onComputeInsets(outInsets: Insets?) {
        super.onComputeInsets(outInsets)
        outInsets?.let {
            it.contentTopInsets = it.visibleTopInsets
            it.touchableInsets = Insets.TOUCHABLE_INSETS_CONTENT
        }
    }
}
