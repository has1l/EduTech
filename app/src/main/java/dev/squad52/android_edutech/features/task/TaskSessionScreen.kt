package dev.squad52.android_edutech.features.task

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.AddToBoosterRequest
import dev.squad52.android_edutech.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun TaskSessionScreen(
    taskIds: List<String>,
    sessionId: String,
    topicId: String,
    onBack: () -> Unit,
    taskVm: TaskViewModel = viewModel(),
    dialogueVm: DialogueViewModel = viewModel()
) {
    val colors = LocalAppColors.current
    val scope = rememberCoroutineScope()

    var allTaskIds by remember { mutableStateOf(taskIds) }
    val pagerState = rememberPagerState(pageCount = { allTaskIds.size })

    var finishLoading by remember { mutableStateOf(false) }
    val solvedCount by remember(allTaskIds) {
        derivedStateOf { allTaskIds.count { taskVm.isSolved(it) } }
    }

    fun dotColor(index: Int): Color {
        val id = allTaskIds.getOrNull(index) ?: return colors.muted
        return when {
            taskVm.isSolved(id) -> AppSuccess
            taskVm.isFailed(id) -> AppDanger
            index == pagerState.currentPage -> AppAccent
            else -> colors.border
        }
    }

    val dotWindow = remember(pagerState.currentPage, allTaskIds.size) {
        val total = allTaskIds.size
        val max = 5
        if (total <= max) (0 until total).toList()
        else {
            val cur = pagerState.currentPage
            val start = maxOf(0, minOf(cur - 2, total - max))
            (start until minOf(start + max, total)).toList()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Закрыть",
                    tint = colors.foreground
                )
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                dotWindow.forEach { idx ->
                    Box(
                        modifier = Modifier
                            .size(if (idx == pagerState.currentPage) 10.dp else 8.dp)
                            .clip(CircleShape)
                            .background(dotColor(idx))
                    )
                }
            }

            TextButton(
                onClick = {
                    scope.launch {
                        finishLoading = true
                        val unsolvedIds = allTaskIds.filter { !taskVm.isSolved(it) }
                        if (unsolvedIds.isNotEmpty()) {
                            unsolvedIds.forEach { id ->
                                val taskState = taskVm.stateFor(id).value
                                val task = taskState.task
                                if (task != null) {
                                    val reason = if (taskState.phase == TaskPhase.Dialogue
                                        || taskState.phase == TaskPhase.GiveUp) "ai" else "skipped"
                                    ApiClient.safeCall {
                                        addToBooster(
                                            AddToBoosterRequest(
                                                taskId = id,
                                                topicId = task.topicId,
                                                reason = reason,
                                                questionPreview = task.questionText.take(80)
                                            )
                                        )
                                    }
                                }
                            }
                            AppState.refreshBoosterCount()
                        }
                        val solved = allTaskIds.count { taskVm.isSolved(it) }
                        if (solved >= 5) {
                            ApiClient.safeCall { recordStreak() }
                        }
                        finishLoading = false
                        onBack()
                    }
                }
            ) {
                if (finishLoading) {
                    CircularProgressIndicator(
                        color = AppAccent,
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Завершить", color = AppAccent, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Progress bar
        val progressText = "${minOf(solvedCount + 1, allTaskIds.size)} / ${allTaskIds.size} для разблокировки"
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            LinearProgressIndicator(
                progress = { if (allTaskIds.isEmpty()) 0f else solvedCount.toFloat() / allTaskIds.size },
                modifier = Modifier.fillMaxWidth(),
                color = AppAccent,
                trackColor = colors.border
            )
            Spacer(Modifier.height(4.dp))
            Text(progressText, fontSize = 12.sp, color = colors.muted)
        }

        Spacer(Modifier.height(8.dp))

        HorizontalPager(
            state = pagerState,
            modifier = Modifier.weight(1f),
            userScrollEnabled = false
        ) { page ->
            val taskId = allTaskIds[page]

            TaskScreen(
                taskId = taskId,
                vm = taskVm,
                dialogueViewModel = dialogueVm,
                onNext = {
                    scope.launch {
                        if (page + 1 < allTaskIds.size) {
                            pagerState.animateScrollToPage(page + 1)
                        }
                    }
                }
            )
        }

        // Add more button
        if (topicId.isNotBlank()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                var addingMore by remember { mutableStateOf(false) }
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            addingMore = true
                            val result = ApiClient.safeCall { getSubtopicSession(topicId, 5) }
                            result.onSuccess { session ->
                                val newIds = session.tasks.map { it.id }
                                allTaskIds = allTaskIds + newIds
                            }
                            addingMore = false
                        }
                    },
                    enabled = !addingMore,
                    shape = RoundedCornerShape(50),
                    colors = OutlinedButtonDefaults.outlinedButtonColors(contentColor = AppAccent),
                    border = ButtonDefaults.outlinedButtonBorder
                ) {
                    if (addingMore) {
                        CircularProgressIndicator(color = AppAccent, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Text("+ Ещё 5 заданий", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
