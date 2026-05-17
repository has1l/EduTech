package dev.squad52.android_edutech.features.booster

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.squad52.android_edutech.models.BoosterItem
import dev.squad52.android_edutech.ui.components.PrimaryButton
import dev.squad52.android_edutech.ui.theme.*

@Composable
fun BoosterScreen(
    onNavigateToTaskSession: (String, String, String) -> Unit,
    vm: BoosterViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val colors = LocalAppColors.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        Text(
            text = "⚡ Бустер",
            fontSize = 24.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.foreground,
            modifier = Modifier.padding(16.dp)
        )

        when {
            state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AppAccent)
            }
            state.error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(state.error!!, color = AppDanger)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { vm.load() }) { Text("Повторить") }
                }
            }
            state.items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🎉", fontSize = 48.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("Бустер пуст!", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = colors.foreground)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Задания, которые ты не решил, появятся здесь",
                        fontSize = 14.sp,
                        color = colors.muted,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 32.dp)
                    )
                }
            }
            else -> {
                val totalCount = state.items.size

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        PrimaryButton(
                            text = "Начать повторение · $totalCount заданий",
                            onClick = {
                                val taskIds = state.items.map { it.taskId }.joinToString(",")
                                onNavigateToTaskSession(taskIds, "", "")
                            }
                        )
                    }

                    val grouped = state.items.groupBy { it.topicId ?: "Прочее" }
                    grouped.forEach { (group, items) ->
                        item {
                            Text(
                                text = group,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = colors.muted,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                        items(items, key = { it.taskId }) { boosterItem ->
                            BoosterItemCard(
                                item = boosterItem,
                                onDelete = { vm.remove(boosterItem.taskId) },
                                onTap = {
                                    onNavigateToTaskSession(
                                        boosterItem.taskId,
                                        "",
                                        boosterItem.topicId ?: ""
                                    )
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BoosterItemCard(
    item: BoosterItem,
    onDelete: () -> Unit,
    onTap: () -> Unit
) {
    val colors = LocalAppColors.current
    var showDeleteDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Удалить задание?") },
            text = { Text(item.questionPreview) },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteDialog = false
                    onDelete()
                }) {
                    Text("Удалить", color = AppDanger)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Отмена")
                }
            },
            containerColor = colors.surface
        )
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        onClick = onTap
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.questionPreview.take(80),
                    fontSize = 14.sp,
                    color = colors.foreground,
                    maxLines = 2
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = item.reason,
                    fontSize = 12.sp,
                    color = colors.muted
                )
            }
            IconButton(onClick = { showDeleteDialog = true }) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Удалить",
                    tint = AppDanger
                )
            }
        }
    }
}
