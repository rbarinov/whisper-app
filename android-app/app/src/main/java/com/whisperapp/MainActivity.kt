package com.whisperapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
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
import com.whisperapp.ui.settings.SettingsScreen
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

    if (settings == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(modifier = Modifier.size(48.dp))
        }
        return
    }

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

            composable(Routes.HISTORY) { backStackEntry ->
                val historyViewModel: HistoryViewModel = hiltViewModel()
                HistoryScreen(
                    viewModel = historyViewModel,
                    onEntryClick = { entryId: String ->
                        navController.navigate(Routes.historyDetail(entryId))
                    }
                )
            }

            composable(
                route = Routes.HISTORY_DETAIL,
                arguments = listOf(
                    navArgument("entryId") { type = NavType.StringType }
                )
            ) { _ ->
                val detailViewModel: HistoryDetailViewModel = hiltViewModel()
                val entry by detailViewModel.entry.collectAsState()

                HistoryDetailScreen(
                    entry = entry,
                    onRetry = { detailViewModel.retryEntry() },
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
