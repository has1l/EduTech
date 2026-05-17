package dev.squad52.android_edutech.features.task

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.squad52.android_edutech.ui.theme.AppAccent
import dev.squad52.android_edutech.ui.theme.AppAccentFg
import dev.squad52.android_edutech.ui.theme.LocalAppColors

private val quickReplies = listOf(
    "не помню",
    "не понимаю",
    "объясни иначе",
    "покажи пример"
)

@Composable
fun DialogueScreen(
    dialogueId: String,
    vm: DialogueViewModel
) {
    val state by vm.state.collectAsState()
    val colors = LocalAppColors.current
    val listState = rememberLazyListState()
    var inputText by remember { mutableStateOf("") }

    LaunchedEffect(dialogueId) {
        vm.loadAndStream(dialogueId)
    }

    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.lastIndex)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.surface)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("🤖", fontSize = 28.sp)
            Column {
                Text(
                    "AI-тьютор",
                    fontWeight = FontWeight.Bold,
                    color = colors.foreground,
                    fontSize = 16.sp
                )
                Text(
                    "Уровень подсказки: ${state.hintLevel}/3",
                    fontSize = 12.sp,
                    color = colors.muted
                )
            }
        }

        HorizontalDivider(color = colors.border)

        // Messages
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
            if (state.isLoading) {
                item {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = AppAccent)
                    }
                }
            }
            items(state.messages) { msg ->
                ChatBubble(msg)
            }
        }

        // Quick replies
        if (!state.isStreaming && state.messages.isNotEmpty()) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(quickReplies) { reply ->
                    AssistChip(
                        onClick = {
                            inputText = ""
                            vm.sendReply(dialogueId, reply)
                        },
                        label = { Text(reply, fontSize = 12.sp) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = colors.surface,
                            labelColor = colors.foreground
                        ),
                        border = AssistChipDefaults.assistChipBorder(
                            borderColor = colors.border
                        )
                    )
                }
            }
        }

        // Input
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.surface)
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                placeholder = { Text("Ответить...", color = colors.muted) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(24.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AppAccent,
                    unfocusedBorderColor = colors.border,
                    focusedTextColor = colors.foreground,
                    unfocusedTextColor = colors.foreground
                ),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(
                    onSend = {
                        if (inputText.isNotBlank() && !state.isStreaming) {
                            val text = inputText
                            inputText = ""
                            vm.sendReply(dialogueId, text)
                        }
                    }
                ),
                maxLines = 3
            )
            IconButton(
                onClick = {
                    if (inputText.isNotBlank() && !state.isStreaming) {
                        val text = inputText
                        inputText = ""
                        vm.sendReply(dialogueId, text)
                    }
                },
                enabled = inputText.isNotBlank() && !state.isStreaming,
                modifier = Modifier
                    .background(
                        if (inputText.isNotBlank()) AppAccent else colors.border,
                        RoundedCornerShape(50)
                    )
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Отправить",
                    tint = if (inputText.isNotBlank()) AppAccentFg else colors.muted
                )
            }
        }
    }
}

@Composable
private fun ChatBubble(msg: ChatMessage) {
    val colors = LocalAppColors.current
    val isUser = msg.role == "user"

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isUser) {
            Text("🤖", fontSize = 20.sp, modifier = Modifier.padding(end = 8.dp, top = 4.dp))
        }

        Column(
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
            modifier = Modifier.widthIn(max = 300.dp)
        ) {
            Box(
                modifier = Modifier
                    .background(
                        if (isUser) AppAccent else colors.surface,
                        RoundedCornerShape(
                            topStart = 16.dp,
                            topEnd = 16.dp,
                            bottomStart = if (isUser) 16.dp else 4.dp,
                            bottomEnd = if (isUser) 4.dp else 16.dp
                        )
                    )
                    .padding(12.dp, 10.dp)
            ) {
                if (msg.isStreaming && msg.content.isEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        repeat(3) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(6.dp),
                                color = colors.muted,
                                strokeWidth = 1.dp
                            )
                        }
                    }
                } else {
                    Text(
                        text = if (msg.isStreaming && msg.content.isEmpty()) "..." else msg.content,
                        color = if (isUser) AppAccentFg else colors.foreground,
                        fontSize = 15.sp
                    )
                }
            }

            msg.theoryRef?.let { ref ->
                if (!ref.title.isNullOrBlank()) {
                    Spacer(Modifier.height(4.dp))
                    AssistChip(
                        onClick = {},
                        label = {
                            Text(
                                "📖 ${ref.title}",
                                fontSize = 12.sp,
                                color = AppAccent
                            )
                        },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = Color.Transparent
                        ),
                        border = AssistChipDefaults.assistChipBorder(borderColor = AppAccent)
                    )
                }
            }
        }

        if (isUser) {
            Spacer(Modifier.width(8.dp))
        }
    }
}
