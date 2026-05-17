package dev.squad52.android_edutech.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

data class AppColors(
    val accent: Color,
    val accentFg: Color,
    val success: Color,
    val danger: Color,
    val background: Color,
    val foreground: Color,
    val surface: Color,
    val muted: Color,
    val border: Color
)

val LocalAppColors = staticCompositionLocalOf {
    AppColors(
        accent = AppAccent,
        accentFg = AppAccentFg,
        success = AppSuccess,
        danger = AppDanger,
        background = DarkBackground,
        foreground = DarkForeground,
        surface = DarkSurface,
        muted = DarkMuted,
        border = DarkBorder
    )
}

private val DarkColorScheme = darkColorScheme(
    primary = AppAccent,
    onPrimary = AppAccentFg,
    background = DarkBackground,
    surface = DarkSurface,
    onBackground = DarkForeground,
    onSurface = DarkForeground
)

private val LightColorScheme = lightColorScheme(
    primary = AppAccent,
    onPrimary = AppAccentFg,
    background = LightBackground,
    surface = LightSurface,
    onBackground = LightForeground,
    onSurface = LightForeground
)

@Composable
fun EduTechTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val appColors = if (darkTheme) {
        AppColors(
            accent = AppAccent,
            accentFg = AppAccentFg,
            success = AppSuccess,
            danger = AppDanger,
            background = DarkBackground,
            foreground = DarkForeground,
            surface = DarkSurface,
            muted = DarkMuted,
            border = DarkBorder
        )
    } else {
        AppColors(
            accent = AppAccent,
            accentFg = AppAccentFg,
            success = AppSuccess,
            danger = AppDanger,
            background = LightBackground,
            foreground = LightForeground,
            surface = LightSurface,
            muted = LightMuted,
            border = LightBorder
        )
    }

    CompositionLocalProvider(LocalAppColors provides appColors) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,
            typography = Typography,
            content = content
        )
    }
}

// Legacy alias for existing references
@Composable
fun Android_EdutechTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) = EduTechTheme(darkTheme = darkTheme, content = content)
