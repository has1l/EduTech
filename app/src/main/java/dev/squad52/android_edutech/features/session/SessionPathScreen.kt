package dev.squad52.android_edutech.features.session

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.squad52.android_edutech.models.PathNode
import dev.squad52.android_edutech.models.PlanGroup
import dev.squad52.android_edutech.models.TaskSection
import dev.squad52.android_edutech.ui.components.PathNodeView
import dev.squad52.android_edutech.ui.components.PrimaryButton
import dev.squad52.android_edutech.ui.theme.AppAccent
import dev.squad52.android_edutech.ui.theme.AppDanger
import dev.squad52.android_edutech.ui.theme.AppSuccess
import dev.squad52.android_edutech.ui.theme.LocalAppColors

@Composable
fun SessionPathScreen(
    onNavigateToTaskSession: (String, String, String) -> Unit,
    onNavigateToDiagnostic: () -> Unit,
    vm: SessionPathViewModel = viewModel()
) {
    val pathState by vm.pathState.collectAsState()
    val planState by vm.planState.collectAsState()
    val generatingPlan by vm.generatingPlan.collectAsState()
    val colors = LocalAppColors.current

    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("⚡ Путь", "🧠 Мой план")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        // Header
        Text(
            text = "Путь",
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.foreground,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, bottom = 8.dp)
        )

        // Tab pills
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .background(colors.surface, RoundedCornerShape(12.dp))
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            tabs.forEachIndexed { idx, label ->
                val sel = selectedTab == idx
                Button(
                    onClick = { selectedTab = idx },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (sel) AppAccent else colors.surface,
                        contentColor = if (sel) Color.Black else colors.muted
                    ),
                    elevation = ButtonDefaults.buttonElevation(0.dp)
                ) {
                    Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        when (selectedTab) {
            0 -> PathTab(
                pathState = pathState,
                onNodeTap = { topicId ->
                    vm.loadSubtopicSession(topicId) { taskIds ->
                        onNavigateToTaskSession(taskIds.joinToString(","), "", topicId)
                    }
                },
                onRefresh = { vm.loadPath() }
            )
            1 -> PlanTab(
                planState = planState,
                generatingPlan = generatingPlan,
                onGeneratePlan = { vm.generatePlan {} },
                onNavigateToDiagnostic = onNavigateToDiagnostic,
                onNodeTap = { topicId ->
                    vm.loadSubtopicSession(topicId) { taskIds ->
                        onNavigateToTaskSession(taskIds.joinToString(","), "", topicId)
                    }
                }
            )
        }
    }
}

@Composable
private fun PathTab(
    pathState: PathUiState,
    onNodeTap: (String) -> Unit,
    onRefresh: () -> Unit
) {
    when (pathState) {
        is PathUiState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = AppAccent)
        }
        is PathUiState.Error -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(pathState.message, color = AppDanger)
                Spacer(Modifier.height(8.dp))
                Button(onClick = onRefresh) { Text("Повторить") }
            }
        }
        is PathUiState.Success -> {
            val sections = pathState.path.sections
            val total = sections.size
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                sections.forEach { section ->
                    item {
                        SectionHeader(section, total)
                    }
                    item {
                        ZigzagNodes(section.nodes, onNodeTap)
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun PlanTab(
    planState: PlanUiState,
    generatingPlan: Boolean,
    onGeneratePlan: () -> Unit,
    onNavigateToDiagnostic: () -> Unit,
    onNodeTap: (String) -> Unit
) {
    val colors = LocalAppColors.current
    when (planState) {
        is PlanUiState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = AppAccent)
        }
        is PlanUiState.Error -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(planState.message, color = AppDanger)
        }
        is PlanUiState.Success -> {
            val planOut = planState.planOut
            if (planOut.needsGeneration || planOut.plan == null) {
                Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text("🧠", fontSize = 48.sp)
                        Text(
                            "AI-план обучения",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.foreground
                        )
                        Text(
                            "Сначала пройди диагностику, чтобы мы знали твой уровень",
                            fontSize = 14.sp,
                            color = colors.muted,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        PrimaryButton(
                            text = "Пройти диагностику",
                            onClick = onNavigateToDiagnostic
                        )
                        Spacer(Modifier.height(8.dp))
                        Button(
                            onClick = onGeneratePlan,
                            enabled = !generatingPlan,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.surface,
                                contentColor = colors.foreground
                            )
                        ) {
                            if (generatingPlan) {
                                CircularProgressIndicator(
                                    color = AppAccent,
                                    modifier = Modifier.size(18.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Составить план (без диагностики)")
                            }
                        }
                    }
                }
            } else {
                val plan = planOut.plan
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp, bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = colors.surface)
                        ) {
                            Text(
                                text = plan.summary,
                                modifier = Modifier.padding(16.dp),
                                fontSize = 14.sp,
                                color = colors.muted
                            )
                        }
                    }
                    items(plan.groups.sortedBy { it.priority }) { group ->
                        PlanGroupCard(group, onNodeTap)
                    }
                }
            }
        }
    }
}

@Composable
private fun PlanGroupCard(group: PlanGroup, onNodeTap: (String) -> Unit) {
    val colors = LocalAppColors.current
    val priorityColor = when (group.priority) {
        1 -> AppDanger
        2 -> AppAccent
        else -> AppSuccess
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Задание ${group.taskNumber}",
                    fontWeight = FontWeight.Bold,
                    color = priorityColor
                )
                Text(
                    text = "${group.masteryPct}%",
                    color = colors.muted,
                    fontSize = 13.sp
                )
            }
            Text(group.title, fontWeight = FontWeight.SemiBold, color = colors.foreground)
            Text(group.why, fontSize = 13.sp, color = colors.muted)
            LinearProgressIndicator(
                progress = { group.masteryPct / 100f },
                modifier = Modifier.fillMaxWidth(),
                color = priorityColor,
                trackColor = colors.border
            )
        }
    }
}

@Composable
private fun SectionHeader(section: TaskSection, totalSections: Int) {
    val colors = LocalAppColors.current
    val headerColor = when (section.difficulty) {
        1 -> AppSuccess
        2 -> AppAccent
        else -> AppDanger
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .background(colors.surface, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(headerColor.copy(alpha = 0.15f))
        ) {
            Text(
                text = "${section.taskNumber}",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = headerColor
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Задание ${section.taskNumber}",
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = headerColor
            )
            Text(
                text = section.title,
                fontSize = 13.sp,
                color = colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Text(
            text = "${section.taskNumber}/$totalSections",
            fontSize = 13.sp,
            color = colors.muted,
            fontWeight = FontWeight.Medium
        )
    }
}

private val zigzagOffsets = listOf(56, 16, -56, -16, 56, 16, -56, -16)

@Composable
private fun ZigzagNodes(nodes: List<PathNode>, onNodeTap: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        nodes.forEachIndexed { idx, node ->
            val offset = zigzagOffsets[idx % zigzagOffsets.size]
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                PathNodeView(
                    state = node.state,
                    title = node.title,
                    subtopicNumber = node.subtopicNumber,
                    onClick = { if (node.state != "locked") onNodeTap(node.topicId) },
                    modifier = Modifier.offset(x = offset.dp)
                )
            }
        }
    }
}
