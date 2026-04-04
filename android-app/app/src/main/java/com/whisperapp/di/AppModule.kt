package com.whisperapp.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.whisperapp.data.local.AppDatabase
import com.whisperapp.data.local.TranscriptionDao
import com.whisperapp.data.remote.ApiKeyInterceptor
import com.whisperapp.data.remote.LlmApi
import com.whisperapp.data.remote.WhisperApi
import com.whisperapp.data.repository.SettingsRepositoryImpl
import com.whisperapp.data.repository.TranscriptionRepositoryImpl
import com.whisperapp.domain.repository.SettingsRepository
import com.whisperapp.domain.repository.TranscriptionRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideGson(): Gson = GsonBuilder().create()

    @Provides
    @Singleton
    fun provideOkHttpClient(apiKeyInterceptor: ApiKeyInterceptor): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(apiKeyInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(gson: Gson, okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://api.openai.com/v1/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }

    @Provides
    @Singleton
    fun provideWhisperApi(retrofit: Retrofit): WhisperApi =
        retrofit.create(WhisperApi::class.java)

    @Provides
    @Singleton
    fun provideLlmApi(retrofit: Retrofit): LlmApi =
        retrofit.create(LlmApi::class.java)

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "whisper_app.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    @Singleton
    fun provideTranscriptionDao(db: AppDatabase): TranscriptionDao = db.transcriptionDao()

    @Provides
    @Singleton
    fun provideTranscriptionRepository(dao: TranscriptionDao): TranscriptionRepository =
        TranscriptionRepositoryImpl(dao)

    @Provides
    @Singleton
    fun provideSettingsRepository(impl: SettingsRepositoryImpl): SettingsRepository = impl

}
