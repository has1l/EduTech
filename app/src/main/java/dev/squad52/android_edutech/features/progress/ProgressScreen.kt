package dev.squad52.android_edutech.features.progress

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.squad52.android_edutech.models.KBStats
import dev.squad52.android_edutech.models.ScorePrediction
import dev.squad52.android_edutech.models.SessionPath
import dev.squad52.android_edutech.models.Streak
import dev.squad52.android_edutech.ui.components.PrimaryButton
import dev.squad52.android_edutech.ui.theme.*

@Composable
fun ProgressScreen(
    onNavigateToDiagnostic: () -> Unit,
    vm: ProgressViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val colors = LocalAppColors.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        Text(
            text = "📊 Прогресс",
            fontSize = 24.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.foreground,
            modifier = Modifier.padding(16.dp)
        )

        if (state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AppAccent)
            }
            return
        }

        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            state.streak?.let { streak ->
                item { StreakCard(streak) }
            }
            state.prediction?.let { pred ->
                item { ScoreCard(pred) }
            }
            state.kbStats?.let { kb ->
                item { KBCard(kb, onNavigateToDiagnostic) }
            }
            state.path?.let { path ->
                item { TopicMapCard(path) }
            }
        }
    }
}

@Composable
private fun StreakCard(streak: Streak) {
    val colors = LocalAppColors.current
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("🔥", fontSize = 32.sp)
                Column {
                    Text(
                        text = "${streak.currentStreak} дн. подряд",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = AppAccent
                    )
                    Text(
                        text = "Рекорд: ${streak.longestStreak} дней",
                        fontSize = 13.sp,
                        color = colors.muted
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                StatChip("❄️ Заморозки", streak.freezesAvailable.toString())
                StatChip("📅 Последняя", streak.lastSessionDate?.take(10) ?: "—")
            }
        }
    }
}

@Composable
private fun ScoreCard(pred: ScorePrediction) {
    val colors = LocalAppColors.current
    val max = pred.maxPossible.toFloat()

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = "Прогноз балла",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = colors.foreground
            )

            ScoreBar("🎯 Цель", pred.target, max, AppAccent)
            ScoreBar("📈 По плану", pred.byPlan, max, AppSuccess)
            ScoreBar("😴 Без занятий", pred.ifNothing, max, AppDanger)

            Text(
                text = pred.explanation,
                fontSize = 13.sp,
                color = colors.muted
            )
        }
    }
}

@Composable
private fun ScoreBar(label: String, score: Int, max: Float, color: androidx.compose.ui.graphics.Color) {
    val colors = LocalAppColors.current
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(label, fontSize = 14.sp, color = colors.foreground)
            Text("$score / ${max.toInt()}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = color)
        }
        LinearProgressIndicator(
            progress = { if (max <= 0) 0f else score / max },
            modifier = Modifier.fillMaxWidth(),
            color = color,
            trackColor = colors.border
        )
    }
}

@Composable
private fun KBCard(kb: KBStats, onStartRepetition: () -> Unit) {
    val colors = LocalAppColors.current
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(kb.levelEmoji, fontSize = 28.sp)
                Column {
                    Text(
                        text = kb.levelName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = colors.foreground
                    )
                    Text(
                        text = "${kb.count} заданий в базе",
                        fontSize = 13.sp,
                        color = colors.muted
                    )
                }
            }
            LinearProgressIndicator(
                progress = { kb.levelPct.toFloat() / 100f },
                modifier = Modifier.fillMaxWidth(),
                color = AppAccent,
                trackColor = colors.border
            )
            kb.nextAt?.let { next ->
                Text(
                    text = "До следующего уровня: $next",
                    fontSize = 12.sp,
                    color = colors.muted
                )
            }
            Button(
                onClick = onStartRepetition,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AppAccent,
                    contentColor = AppAccentFg
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Повторение — мать учения", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun TopicMapCard(path: SessionPath) {
    val colors = LocalAppColors.current
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = "Карта тем",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = colors.foreground
            )
            path.sections.forEach { section ->
                val total = section.nodes.size
                val completed = section.nodes.count { it.state == "completed" }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "${section.taskNumber}. ${section.title}",
                            fontSize = 14.sp,
                            color = colors.foreground,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "$completed/$total",
                            fontSize = 13.sp,
                            color = colors.muted
                        )
                    }
                    LinearProgressIndicator(
                        progress = { if (total == 0) 0f else completed.toFloat() / total },
                        modifier = Modifier.fillMaxWidth(),
                        color = when (section.difficulty) {
                            1 -> AppSuccess
                            2 -> AppAccent
                            else -> AppDanger
                        },
                        trackColor = colors.border
                    )
                }
            }
        }
    }
}

@Composable
private fun StatChip(label: String, value: String) {
    val colors = LocalAppColors.current
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = colors.foreground)
        Text(label, fontSize = 12.sp, color = colors.muted)
    }
}
