package dev.squad52.android_edutech.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.squad52.android_edutech.ui.theme.AppAccent
import dev.squad52.android_edutech.ui.theme.AppSuccess
import dev.squad52.android_edutech.ui.theme.LocalAppColors

@Composable
fun PathNodeView(
    state: String,
    title: String,
    subtopicNumber: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val faceColor = when (state) {
        "current" -> AppAccent
        "completed" -> AppSuccess
        else -> Color(0xFFD4D4D4)
    }
    val shadowColor = faceColor.copy(
        red = faceColor.red * 0.65f,
        green = faceColor.green * 0.65f,
        blue = faceColor.blue * 0.65f
    )

    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = EaseOut),
            repeatMode = RepeatMode.Restart
        ),
        label = "alpha"
    )
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.6f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = EaseOut),
            repeatMode = RepeatMode.Restart
        ),
        label = "scale"
    )

    val colors = LocalAppColors.current

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier.padding(4.dp)
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(72.dp)
                .clickable(enabled = state != "locked") { onClick() }
        ) {
            if (state == "current") {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .scale(pulseScale)
                        .clip(CircleShape)
                        .background(AppAccent.copy(alpha = pulseAlpha))
                )
            }

            // Shadow circle
            Box(
                modifier = Modifier
                    .size(58.dp)
                    .offset(y = 5.dp)
                    .clip(CircleShape)
                    .background(shadowColor)
            )

            // Face circle
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(58.dp)
                    .clip(CircleShape)
                    .background(faceColor)
            ) {
                val icon = when (state) {
                    "current" -> "⚡"
                    "completed" -> "✓"
                    else -> "🔒"
                }
                Text(
                    text = icon,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = when (state) {
                        "locked" -> Color(0xFF888888)
                        else -> Color.Black
                    }
                )
            }
        }

        Spacer(Modifier.height(6.dp))
        Text(
            text = subtopicNumber,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = when (state) {
                "current" -> colors.foreground
                "completed" -> AppSuccess
                else -> colors.muted.copy(alpha = 0.5f)
            }
        )
        Text(
            text = title,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = when (state) {
                "current" -> colors.foreground
                "completed" -> AppSuccess
                else -> colors.muted.copy(alpha = 0.5f)
            },
            maxLines = 2,
            modifier = Modifier.widthIn(max = 104.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}
