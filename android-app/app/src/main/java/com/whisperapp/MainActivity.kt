package com.whisperapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.whisperapp.domain.repository.SettingsRepository
import com.whisperapp.ui.history.HistoryDetailScreen
import com.whisperapp.ui.history.HistoryDetailViewModel
import com.whisperapp.ui.history.HistoryScreen
import com.whisperapp.ui.history.HistoryViewModel
import com.whisperapp.ui.onboarding.OnboardingScreen
import com.whisperapp.ui.recording.RecordingScreen
import com.whisperapp.ui.recording.RecordingViewModel
import com.whisperapp.ui.settings.SettingsScreen
import com.whisperapp.ui.settings.SettingsViewModel
import com.whisperapp.ui.theme.WhisperAppTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

object Routes {
    const val RECORDING = "recording"
    const val HISTORY = "history"
    const val HISTORY_DETAIL = "history/{entryId}"
    const val SETTINGS = "settings"

    fun historyDetail(entryId: String) = "history/$entryId"
}

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var settingsRepository: SettingsRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            WhisperAppTheme {
                WhisperAppContent(settingsRepository = settingsRepository)
            }
        }
    }
}

@Composable
fun WhisperAppContent(settingsRepository: SettingsRepository) {
    val settings by settingsRepository.settings.collectAsState(initial = null)
    val navController = rememberNavController()

    val bottomNavItems = listOf(
        BottomNavItem(Routes.RECORDING, "Record", Icons.Default.Mic),
        BottomNavItem(Routes.HISTORY, "History", Icons.Default.History),
        BottomNavItem(Routes.SETTINGS, "Settings", Icons.Default.Settings)
    )

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val showBottomBar = currentDestination?.hierarchy?.any { dest ->
        bottomNavItems.any { it.route == dest.route }
    } == true

    if (settings == null) return

    if (!settings!!.onboardingCompleted) {
        OnboardingScreen(
            viewModel = hiltViewModel(),
            onComplete = {
                navController.navigate(Routes.RECORDING) {
                    popUpTo(0) { inclusive = true }
                }
            }
        )
        return
    }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                            selected = currentDestination?.hierarchy?.any { it.route == item.route } == true,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = Routes.RECORDING,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable(Routes.RECORDING) {
                RecordingScreen(viewModel = hiltViewModel())
            }

            composable(Routes.HISTORY) {
                HistoryScreen(
                    viewModel = hiltViewModel(),
                    onEntryClick = { entryId ->
                        navController.navigate(Routes.historyDetail(entryId))
                    }
                )
            }

            composable(
                route = Routes.HISTORY_DETAIL,
                arguments = listOf(
                    navArgument("entryId") { type = NavType.StringType }
                )
            ) {
                val detailViewModel: HistoryDetailViewModel = hiltViewModel()
                val entry by detailViewModel.entry.collectAsState()
                val recordingViewModel: RecordingViewModel = hiltViewModel()

                HistoryDetailScreen(
                    entry = entry,
                    onRetry = { recordingViewModel.retryRecording(it) },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Routes.SETTINGS) {
                SettingsScreen(viewModel = hiltViewModel())
            }
        }
    }
}

private data class BottomNavItem(val route: String, val label: String, val icon: ImageVector)
