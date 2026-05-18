package dev.squad52.android_edutech.nav

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.features.auth.LoginScreen
import dev.squad52.android_edutech.features.booster.BoosterScreen
import dev.squad52.android_edutech.features.diagnostic.DiagnosticScreen
import dev.squad52.android_edutech.features.onboarding.OnboardingScreen
import dev.squad52.android_edutech.features.profile.ProfileScreen
import dev.squad52.android_edutech.features.progress.ProgressScreen
import dev.squad52.android_edutech.features.session.SessionPathScreen
import dev.squad52.android_edutech.features.task.TaskSessionScreen
import dev.squad52.android_edutech.ui.theme.AppAccent
import dev.squad52.android_edutech.ui.theme.LocalAppColors

sealed class Route(val route: String) {
    object Login : Route("login")
    object Onboarding : Route("onboarding")
    object Main : Route("main")
    object Diagnostic : Route("diagnostic")
    object TaskSession : Route("task_session?taskIds={taskIds}&sessionId={sessionId}&topicId={topicId}") {
        fun build(taskIds: String, sessionId: String = "", topicId: String = "") =
            "task_session?taskIds=$taskIds&sessionId=$sessionId&topicId=$topicId"
    }
}

sealed class BottomTab(val route: String, val label: String, val icon: String) {
    object Course : BottomTab("course", "Курс", "📚")
    object Booster : BottomTab("booster", "Бустер", "⚡")
    object Progress : BottomTab("progress", "Прогресс", "📊")
    object Profile : BottomTab("profile", "Профиль", "👤")
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val showLogin by AppState.showLoginFlow.collectAsState()
    val currentUser by AppState.currentUser.collectAsState()
    val isBootstrapped by AppState.isBootstrapped.collectAsState()

    if (!isBootstrapped) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = AppAccent)
        }
        return
    }

    NavHost(
        navController = navController,
        startDestination = when {
            showLogin -> Route.Login.route
            AppState.needsOnboarding() -> Route.Onboarding.route
            else -> Route.Main.route
        },
        enterTransition = { EnterTransition.None },
        exitTransition = { ExitTransition.None }
    ) {
        composable(Route.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    if (AppState.needsOnboarding()) {
                        navController.navigate(Route.Onboarding.route) {
                            popUpTo(Route.Login.route) { inclusive = true }
                        }
                    } else {
                        navController.navigate(Route.Main.route) {
                            popUpTo(Route.Login.route) { inclusive = true }
                        }
                    }
                }
            )
        }
        composable(Route.Onboarding.route) {
            OnboardingScreen(
                onDone = {
                    navController.navigate(Route.Main.route) {
                        popUpTo(Route.Onboarding.route) { inclusive = true }
                    }
                }
            )
        }
        composable(Route.Main.route) {
            val pendingDiagnostic by AppState.pendingDiagnostic.collectAsState()
            LaunchedEffect(pendingDiagnostic) {
                if (pendingDiagnostic) {
                    AppState.setPendingDiagnostic(false)
                    navController.navigate(Route.Diagnostic.route)
                }
            }
            MainScreen(
                onNavigateToTaskSession = { taskIds, sessionId, topicId ->
                    navController.navigate(Route.TaskSession.build(taskIds, sessionId, topicId))
                },
                onNavigateToDiagnostic = {
                    navController.navigate(Route.Diagnostic.route)
                }
            )
        }
        composable(Route.Diagnostic.route) {
            DiagnosticScreen(
                onBack = { navController.popBackStack() },
                onDone = { navController.popBackStack() }
            )
        }
        composable(
            Route.TaskSession.route,
            arguments = listOf(
                navArgument("taskIds") { type = NavType.StringType; defaultValue = "" },
                navArgument("sessionId") { type = NavType.StringType; defaultValue = "" },
                navArgument("topicId") { type = NavType.StringType; defaultValue = "" }
            )
        ) { backStackEntry ->
            val taskIds = backStackEntry.arguments?.getString("taskIds") ?: ""
            val sessionId = backStackEntry.arguments?.getString("sessionId") ?: ""
            val topicId = backStackEntry.arguments?.getString("topicId") ?: ""
            TaskSessionScreen(
                taskIds = taskIds.split(",").filter { it.isNotBlank() },
                sessionId = sessionId,
                topicId = topicId,
                onBack = { navController.popBackStack() }
            )
        }
    }
}

@Composable
fun MainScreen(
    onNavigateToTaskSession: (String, String, String) -> Unit,
    onNavigateToDiagnostic: () -> Unit
) {
    val tabs = listOf(
        BottomTab.Course,
        BottomTab.Booster,
        BottomTab.Progress,
        BottomTab.Profile
    )

    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val boosterCount by AppState.boosterCount.collectAsState()
    val colors = LocalAppColors.current

    Scaffold(
        containerColor = colors.background,
        bottomBar = {
            NavigationBar(
                containerColor = colors.surface,
                tonalElevation = 0.dp
            ) {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = currentRoute == tab.route,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = {
                            Box {
                                Text(
                                    text = tab.icon,
                                    fontSize = 22.sp
                                )
                                if (tab == BottomTab.Booster && boosterCount > 0) {
                                    Badge(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .size(16.dp),
                                        containerColor = AppAccent,
                                        contentColor = Color.Black
                                    ) {
                                        Text(
                                            text = boosterCount.toString(),
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        },
                        label = {
                            Text(
                                text = tab.label,
                                fontSize = 11.sp
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = AppAccent,
                            selectedTextColor = AppAccent,
                            unselectedIconColor = colors.muted,
                            unselectedTextColor = colors.muted,
                            indicatorColor = Color.Transparent
                        )
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = BottomTab.Course.route,
            modifier = Modifier.padding(padding),
            enterTransition = { EnterTransition.None },
            exitTransition = { ExitTransition.None }
        ) {
            composable(BottomTab.Course.route) {
                SessionPathScreen(
                    onNavigateToTaskSession = onNavigateToTaskSession,
                    onNavigateToDiagnostic = onNavigateToDiagnostic
                )
            }
            composable(BottomTab.Booster.route) {
                BoosterScreen(
                    onNavigateToTaskSession = onNavigateToTaskSession
                )
            }
            composable(BottomTab.Progress.route) {
                ProgressScreen(
                    onNavigateToDiagnostic = onNavigateToDiagnostic
                )
            }
            composable(BottomTab.Profile.route) {
                ProfileScreen()
            }
        }
    }
}
