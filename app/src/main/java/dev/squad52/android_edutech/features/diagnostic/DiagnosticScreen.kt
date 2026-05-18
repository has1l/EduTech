package dev.squad52.android_edutech.features.diagnostic

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.squad52.android_edutech.models.DiagnosticSectionResult
import dev.squad52.android_edutech.models.EduTask
import dev.squad52.android_edutech.models.TaskOption
import dev.squad52.android_edutech.ui.components.MathText
import dev.squad52.android_edutech.ui.components.PrimaryButton
import dev.squad52.android_edutech.ui.components.TaskImage
import dev.squad52.android_edutech.ui.theme.*

@Composable
fun DiagnosticScreen(
    onBack: () -> Unit,
    onDone: () -> Unit,
    vm: DiagnosticViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val colors = LocalAppColors.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = colors.foreground)
            }
            Text(
                text = "Диагностика",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = colors.foreground
            )
        }

        when (val s = state) {
            is DiagnosticUiState.Intro -> IntroPhase(
                onStart = { vm.startDiagnostic() }
            )
            is DiagnosticUiState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AppAccent)
            }
            is DiagnosticUiState.Quiz -> QuizPhase(
                quiz = s,
                onAnswer = vm::setAnswer,
                onNext = vm::nextPage,
                onPrev = vm::prevPage,
                onSubmit = vm::submit
            )
            is DiagnosticUiState.Result -> ResultPhase(
                result = s.result,
                onDone = onDone
            )
            is DiagnosticUiState.Error -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(s.message, color = AppDanger)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { vm.startDiagnostic() }) { Text("Повторить") }
                }
            }
        }
    }
}

@Composable
private fun IntroPhase(onStart: () -> Unit) {
    val colors = LocalAppColors.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(32.dp))
        Text("🎯", fontSize = 64.sp)
        Text(
            text = "Диагностика",
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.foreground
        )
        Text(
            text = "~20 заданий · 15-20 минут",
            fontSize = 16.sp,
            color = colors.muted
        )

        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = colors.surface)
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                DiagRow("📊", "Выявим пробелы", "AI-анализ твоих ответов")
                DiagRow("🗺️", "Карта знаний", "Красное/жёлтое/зелёное по темам")
                DiagRow("🎯", "Прогноз балла", "Что будет если заниматься по плану")
            }
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = "Начать диагностику",
            onClick = onStart
        )
    }
}

@Composable
private fun DiagRow(icon: String, title: String, subtitle: String) {
    val colors = LocalAppColors.current
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(icon, fontSize = 24.sp)
        Column {
            Text(title, fontWeight = FontWeight.SemiBold, color = colors.foreground)
            Text(subtitle, fontSize = 13.sp, color = colors.muted)
        }
    }
}

@Composable
private fun QuizPhase(
    quiz: DiagnosticUiState.Quiz,
    onAnswer: (String, String) -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onSubmit: () -> Unit
) {
    val colors = LocalAppColors.current
    val tasks = quiz.session.tasks
    val totalTasks = tasks.size
    val currentPage = quiz.currentPage
    val currentTask = tasks.getOrNull(currentPage)
    val isLast = currentPage == totalTasks - 1

    Column(modifier = Modifier.fillMaxSize()) {
        LinearProgressIndicator(
            progress = { (currentPage + 1).toFloat() / totalTasks },
            modifier = Modifier.fillMaxWidth(),
            color = AppAccent,
            trackColor = colors.border
        )
        Text(
            text = "${currentPage + 1} / $totalTasks",
            fontSize = 12.sp,
            color = colors.muted,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
        )

        if (currentTask != null) {
            DiagnosticTaskPage(
                task = currentTask,
                savedAnswer = quiz.answers[currentTask.id] ?: "",
                onAnswer = { answer -> onAnswer(currentTask.id, answer) },
                modifier = Modifier.weight(1f)
            )
        } else {
            Spacer(Modifier.weight(1f))
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (currentPage > 0) {
                OutlinedButton(
                    onClick = onPrev,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Назад")
                }
            }
            Button(
                onClick = if (isLast) onSubmit else onNext,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AppAccent,
                    contentColor = AppAccentFg
                )
            ) {
                Text(
                    text = if (isLast) "Завершить" else "Далее",
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun DiagnosticTaskPage(
    task: EduTask,
    savedAnswer: String,
    onAnswer: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalAppColors.current
    var textAnswer by remember(task.id) { mutableStateOf(savedAnswer) }
    var selectedOption by remember(task.id) { mutableStateOf(savedAnswer) }
    val isMultiple = !task.options.isNullOrEmpty()

    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!task.questionImageUrl.isNullOrBlank()) {
            TaskImage(url = task.questionImageUrl)
        }
        if (task.questionText.isNotBlank()) {
            MathText(text = task.questionText, fontSize = 16)
        }

        if (isMultiple) {
            val letters = listOf("A", "Б", "В", "Г")
            task.options!!.forEachIndexed { idx, option ->
                val isSelected = selectedOption == option.id
                OutlinedButton(
                    onClick = {
                        selectedOption = option.id
                        onAnswer(option.id)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (isSelected) AppAccent.copy(alpha = 0.15f) else Color.Transparent,
                        contentColor = if (isSelected) AppAccent else colors.foreground
                    ),
                    border = BorderStroke(
                        width = if (isSelected) 2.dp else 1.dp,
                        color = if (isSelected) AppAccent else colors.border
                    )
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(letters.getOrElse(idx) { (idx + 1).toString() }, fontWeight = FontWeight.Bold)
                        Text(option.text, modifier = Modifier.weight(1f), textAlign = TextAlign.Start)
                    }
                }
            }
        } else {
            OutlinedTextField(
                value = textAnswer,
                onValueChange = {
                    textAnswer = it
                    onAnswer(it)
                },
                label = { Text("Введи ответ") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AppAccent,
                    unfocusedBorderColor = colors.border,
                    focusedTextColor = colors.foreground,
                    unfocusedTextColor = colors.foreground
                ),
                singleLine = true
            )
        }
    }
}

@Composable
private fun ResultPhase(
    result: dev.squad52.android_edutech.models.DiagnosticResult,
    onDone: () -> Unit
) {
    val colors = LocalAppColors.current
    val score = result.correct
    val total = result.total
    val pct = if (total > 0) score * 100 / total else 0

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(16.dp))
        Text(
            text = when {
                pct >= 80 -> "🏆"
                pct >= 60 -> "🎯"
                pct >= 40 -> "📚"
                else -> "💪"
            },
            fontSize = 56.sp
        )
        Text(
            text = "$score / $total правильно",
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.foreground
        )
        Text(
            text = "$pct%",
            fontSize = 18.sp,
            color = when {
                pct >= 70 -> AppSuccess
                pct >= 50 -> AppAccent
                else -> AppDanger
            }
        )

        LinearProgressIndicator(
            progress = { pct / 100f },
            modifier = Modifier.fillMaxWidth(),
            color = when {
                pct >= 70 -> AppSuccess
                pct >= 50 -> AppAccent
                else -> AppDanger
            },
            trackColor = colors.border
        )

        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = colors.surface),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(8.dp)) {
                result.sections.forEach { section ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Зад. ${section.taskNumber}",
                                fontWeight = FontWeight.SemiBold,
                                color = if (section.isCorrect) AppSuccess else AppDanger,
                                fontSize = 13.sp
                            )
                            Text(section.topicTitle, fontSize = 11.sp, color = colors.muted)
                        }
                        Text(
                            text = if (section.isCorrect) "✓" else "✗",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (section.isCorrect) AppSuccess else AppDanger
                        )
                    }
                    if (section != result.sections.last()) {
                        HorizontalDivider(color = colors.border)
                    }
                }
            }
        }

        PrimaryButton(text = "Отлично! Продолжить", onClick = onDone)
        Spacer(Modifier.height(24.dp))
    }
}
