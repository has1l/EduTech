package dev.squad52.android_edutech.features.onboarding

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.UpdateProfileRequest
import dev.squad52.android_edutech.ui.components.PrimaryButton
import dev.squad52.android_edutech.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.Calendar

class OnboardingViewModel : ViewModel() {
    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun save(grade: Int, targetScore: Int, examDate: String, onDone: () -> Unit) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            val result = ApiClient.safeCall {
                updateMe(
                    UpdateProfileRequest(
                        grade = grade,
                        targetScore = targetScore,
                        currentScore = null,
                        ogeCurrentScore = null,
                        examDate = examDate,
                        name = null
                    )
                )
            }
            result.onSuccess { user ->
                AppState.setUser(user)
                AppState.setPendingDiagnostic(true)
                _loading.value = false
                onDone()
            }.onFailure { e ->
                _error.value = e.message
                _loading.value = false
            }
        }
    }
}

@Composable
fun OnboardingScreen(
    onDone: () -> Unit,
    vm: OnboardingViewModel = viewModel()
) {
    val loading by vm.loading.collectAsState()
    val error by vm.error.collectAsState()
    val colors = LocalAppColors.current

    var grade by remember { mutableStateOf(11) }
    var targetScore by remember { mutableStateOf(65) }
    val currentYear = remember { Calendar.getInstance().get(Calendar.YEAR) }
    var examYear by remember { mutableStateOf(currentYear) }
    var step by remember { mutableStateOf(0) }

    val pagerState = rememberPagerState(pageCount = { 3 })
    LaunchedEffect(step) { pagerState.animateScrollToPage(step) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        Spacer(Modifier.height(12.dp))

        LinearProgressIndicator(
            progress = { (step + 1) / 3f },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            color = AppAccent,
            trackColor = colors.border
        )

        HorizontalPager(
            state = pagerState,
            modifier = Modifier.weight(1f),
            userScrollEnabled = false
        ) { page ->
            when (page) {
                0 -> GradeStep(grade = grade, onSelect = { selected ->
                    grade = selected
                    targetScore = if (selected <= 9) 4 else 65
                })
                1 -> TargetScoreStep(grade = grade, targetScore = targetScore, onSelect = { targetScore = it })
                2 -> YearStep(
                    examYear = examYear,
                    years = listOf(currentYear, currentYear + 1, currentYear + 2),
                    onSelect = { examYear = it }
                )
            }
        }

        error?.let {
            Text(
                it, color = AppDanger, fontSize = 14.sp,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (step > 0) {
                OutlinedButton(
                    onClick = { step-- },
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.foreground),
                    border = BorderStroke(1.dp, colors.border)
                ) {
                    Text("Назад", fontWeight = FontWeight.SemiBold)
                }
            }
            PrimaryButton(
                text = if (step == 2) "Готово" else "Дальше",
                onClick = {
                    if (step < 2) step++
                    else vm.save(grade, targetScore, "$examYear-06-01", onDone)
                },
                loading = loading && step == 2,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun GradeStep(grade: Int, onSelect: (Int) -> Unit) {
    val colors = LocalAppColors.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "К чему готовишься?",
                fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = colors.foreground
            )
            Text("Выбери экзамен", fontSize = 16.sp, color = colors.muted)
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            listOf(Triple(9, "ОГЭ", "9 класс"), Triple(11, "ЕГЭ", "11 класс"))
                .forEach { (value, exam, classLabel) ->
                    val active = grade == value
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (active) colors.foreground else colors.background)
                            .border(
                                1.dp,
                                if (active) colors.foreground else colors.border,
                                RoundedCornerShape(20.dp)
                            )
                            .clickable { onSelect(value) }
                            .padding(20.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                exam, fontSize = 20.sp, fontWeight = FontWeight.Bold,
                                color = if (active) colors.background else colors.foreground
                            )
                            Text(
                                classLabel, fontSize = 13.sp,
                                color = if (active) colors.background.copy(alpha = 0.7f) else colors.muted
                            )
                        }
                        if (active) {
                            Text(
                                "✓", fontSize = 20.sp, fontWeight = FontWeight.Bold,
                                color = colors.background
                            )
                        }
                    }
                }
        }
        Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun TargetScoreStep(grade: Int, targetScore: Int, onSelect: (Int) -> Unit) {
    val colors = LocalAppColors.current
    val isOge = grade <= 9
    val options = if (isOge) {
        listOf(Triple(3, "3", "Трояк"), Triple(4, "4", "Хорошо"), Triple(5, "5", "Отлично"))
    } else {
        listOf(
            Triple(40, "40+", "Начало"), Triple(55, "55+", "Хорошо"),
            Triple(65, "65+", "Отлично"), Triple(70, "70", "Максимум")
        )
    }
    val columns = if (isOge) 3 else 2

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                if (isOge) "Какую оценку хочешь?" else "Какой балл хочешь?",
                fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = colors.foreground
            )
            Text(
                if (isOge) "Любую — поможем" else "Часть 1: до 70 тестовых баллов",
                fontSize = 16.sp, color = colors.muted
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            options.chunked(columns).forEach { rowItems ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    rowItems.forEach { (value, score, label) ->
                        val active = targetScore == value
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(20.dp))
                                .background(if (active) colors.foreground else colors.background)
                                .border(
                                    1.dp,
                                    if (active) colors.foreground else colors.border,
                                    RoundedCornerShape(20.dp)
                                )
                                .clickable { onSelect(value) }
                                .padding(vertical = 20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                score, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold,
                                color = if (active) colors.background else colors.foreground
                            )
                            Text(
                                label, fontSize = 12.sp,
                                color = if (active) colors.background.copy(alpha = 0.7f) else colors.muted
                            )
                        }
                    }
                    if (rowItems.size < columns) {
                        Spacer(Modifier.weight((columns - rowItems.size).toFloat()))
                    }
                }
            }
        }
        Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun YearStep(examYear: Int, years: List<Int>, onSelect: (Int) -> Unit) {
    val colors = LocalAppColors.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Когда экзамен?",
                fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = colors.foreground
            )
            Text("Год сдачи", fontSize = 16.sp, color = colors.muted)
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            years.forEach { y ->
                val active = examYear == y
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(64.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (active) colors.foreground else colors.background)
                        .border(
                            1.dp,
                            if (active) colors.foreground else colors.border,
                            RoundedCornerShape(20.dp)
                        )
                        .clickable { onSelect(y) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = y.toString(),
                        fontSize = 18.sp, fontWeight = FontWeight.Bold,
                        color = if (active) colors.background else colors.foreground
                    )
                }
            }
        }
        Spacer(Modifier.weight(1f))
    }
}
