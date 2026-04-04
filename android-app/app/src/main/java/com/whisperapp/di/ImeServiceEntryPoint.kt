package com.whisperapp.di

import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface ImeServiceEntryPoint {
    fun keyboardViewModelFactory(): KeyboardViewModelFactory
}
