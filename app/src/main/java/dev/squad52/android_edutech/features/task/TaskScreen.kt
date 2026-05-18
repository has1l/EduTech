package dev.squad52.android_edutech.features.task

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.squad52.android_edutech.models.EduTask
import dev.squad52.android_edutech.models.TaskOption
import dev.squad52.android_edutech.ui.components.MathText
import dev.squad52.android_edutech.ui.components.TaskImage
import dev.squad52.android_edutech.ui.theme.*

@Composable
fun TaskScreen(
    taskId: String,
    vm: TaskViewModel,
    dialogueViewModel: DialogueViewModel,
    onNext: (() -> Unit)? = null
) {
    val state by vm.stateFor(taskId).collectAsState()
    val colors = LocalAppColors.current

    LaunchedEffect(taskId) {
        vm.loadTask(taskId)
    }

    var activeTab by remember { mutableStateOf(0) }
    val showTabs = state.phase == TaskPhase.Dialogue || state.phase == TaskPhase.GiveUp

    LaunchedEffect(state.phase) {
        if (showTabs) activeTab = 1
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        when (state.phase) {
            TaskPhase.Loading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppAccent)
                }
            }
            else -> {
                val task = state.task

                if (showTabs) {
                    // Tab switcher
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                            .background(colors.surface, RoundedCornerShape(10.dp))
                            .padding(4.dp)
                    ) {
                        listOf("Условие", "Тьютор").forEachIndexed { idx, label ->
                            val sel = activeTab == idx
                            Button(
                                onClick = { activeTab = idx },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(6.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (sel) AppAccent else colors.surface,
                                    contentColor = if (sel) AppAccentFg else colors.muted
                                ),
                                elevation = ButtonDefaults.buttonElevation(0.dp)
                            ) {
                                Text(label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }

                when {
                    activeTab == 1 && showTabs -> {
                        val dialogueId = state.dialogueId
                        if (dialogueId != null) {
                            DialogueScreen(dialogueId = dialogueId, vm = dialogueViewModel)
                        }
                    }
                    else -> {
                        if (task != null) {
                            ConditionTab(
                                task = task,
                                phase = state.phase,
                                selectedAnswer = state.selectedAnswer,
                                correctAnswer = state.correctAnswer,
                                onSubmit = { answer -> vm.submitAnswer(taskId, answer) },
                                onStartDialogue = { vm.startDialogue(taskId) },
                                onGiveUp = { vm.giveUp(taskId) },
                                onNext = onNext
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConditionTab(
    task: EduTask,
    phase: TaskPhase,
    selectedAnswer: String?,
    correctAnswer: String?,
    onSubmit: (String) -> Unit,
    onStartDialogue: () -> Unit,
    onGiveUp: () -> Unit,
    onNext: (() -> Unit)?
) {
    val colors = LocalAppColors.current
    val isMultipleChoice = !task.options.isNullOrEmpty()
    var textAnswer by remember { mutableStateOf("") }
    var localSelected by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Question image
        if (!task.questionImageUrl.isNullOrBlank()) {
            TaskImage(url = task.questionImageUrl)
        }

        // Question text
        if (task.questionText.isNotBlank()) {
            MathText(text = task.questionText, fontSize = 16)
        }

        // Phase banners
        when (phase) {
            TaskPhase.Correct -> {
                ResultBanner(
                    text = "✓ Верно!",
                    color = AppSuccess,
                    bgColor = AppSuccess.copy(alpha = 0.15f)
                )
                onNext?.let {
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = it,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = AppSuccess)
                    ) {
                        Text("Следующее", fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }
            TaskPhase.Wrong -> {
                ResultBanner(
                    text = "✗ Неверно: $selectedAnswer",
                    color = AppDanger,
                    bgColor = AppDanger.copy(alpha = 0.15f)
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Button(
                        onClick = onStartDialogue,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = AppAccent)
                    ) {
                        Text("Помоги разобрать", fontWeight = FontWeight.Bold, color = AppAccentFg, fontSize = 13.sp)
                    }
                    Button(
                        onClick = onGiveUp,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = colors.surface)
                    ) {
                        Text("Объяснить сразу", fontWeight = FontWeight.Bold, color = colors.foreground, fontSize = 13.sp)
                    }
                }
            }
            TaskPhase.GiveUp -> {
                correctAnswer?.let { ans ->
                    ResultBanner(
                        text = "Правильный ответ: $ans",
                        color = AppAccent,
                        bgColor = AppAccent.copy(alpha = 0.15f)
                    )
                }
                onNext?.let {
                    Button(
                        onClick = it,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = colors.surface)
                    ) {
                        Text("Следующее", fontWeight = FontWeight.Bold, color = colors.foreground)
                    }
                }
            }
            else -> {}
        }

        // Answer input
        if (phase == TaskPhase.Question || phase == TaskPhase.Submitting) {
            if (isMultipleChoice) {
                MultipleChoiceOptions(
                    options = task.options!!,
                    selected = localSelected,
                    onSelect = { localSelected = it }
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { localSelected?.let { onSubmit(it) } },
                    enabled = localSelected != null && phase != TaskPhase.Submitting,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppAccent,
                        contentColor = AppAccentFg
                    )
                ) {
                    if (phase == TaskPhase.Submitting) {
                        CircularProgressIndicator(
                            color = AppAccentFg,
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Ответить", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            } else {
                OutlinedTextField(
                    value = textAnswer,
                    onValueChange = { textAnswer = it },
                    label = { Text("Введи ответ") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AppAccent,
                        focusedLabelColor = AppAccent,
                        unfocusedBorderColor = colors.border,
                        focusedTextColor = colors.foreground,
                        unfocusedTextColor = colors.foreground
                    ),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(
                        onDone = { if (textAnswer.isNotBlank()) onSubmit(textAnswer) }
                    ),
                    singleLine = true
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { onSubmit(textAnswer) },
                    enabled = textAnswer.isNotBlank() && phase != TaskPhase.Submitting,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppAccent,
                        contentColor = AppAccentFg
                    )
                ) {
                    if (phase == TaskPhase.Submitting) {
                        CircularProgressIndicator(
                            color = AppAccentFg,
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Ответить", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun MultipleChoiceOptions(
    options: List<TaskOption>,
    selected: String?,
    onSelect: (String) -> Unit
) {
    val colors = LocalAppColors.current

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            val isSelected = selected == option.id
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (isSelected) AppAccent.copy(alpha = 0.18f) else colors.surface
                    )
                    .border(
                        width = 2.dp,
                        color = if (isSelected) AppAccent else colors.border,
                        shape = RoundedCornerShape(12.dp)
                    )
                    .clickable { onSelect(option.id) }
                    .padding(14.dp),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Letter badge using option.id (matches iOS: uses opt.id directly)
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(28.dp)
                        .background(
                            if (isSelected) colors.foreground else colors.border.copy(alpha = 0.4f),
                            CircleShape
                        )
                ) {
                    Text(
                        text = option.id,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = if (isSelected) colors.background else colors.foreground
                    )
                }
                Text(
                    text = option.text,
                    fontSize = 15.sp,
                    color = colors.foreground,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun ResultBanner(text: String, color: Color, bgColor: Color) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(bgColor, RoundedCornerShape(12.dp))
            .border(2.dp, color.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .padding(16.dp)
    ) {
        Text(
            text = text,
            color = color,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
    }
}
