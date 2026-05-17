package dev.squad52.android_edutech

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.nav.AppNavigation
import dev.squad52.android_edutech.ui.theme.EduTechTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            EduTechTheme {
                LaunchedEffect(Unit) {
                    AppState.bootstrap()
                }
                AppNavigation()
            }
        }
    }
}
