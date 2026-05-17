package dev.squad52.android_edutech.features.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import dev.squad52.android_edutech.ui.theme.AppAccent
import dev.squad52.android_edutech.ui.theme.AppDanger
import dev.squad52.android_edutech.ui.theme.LocalAppColors
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class OnboardingViewModel : ViewModel() {
    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun save(grade: Int, targetScore: Int, onDone: () -> Unit) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            val result = ApiClient.safeCall {
                updateMe(
                    UpdateProfileRequest(
                        grade = grade,
                        targetScore = targetScore,
                        currentScore = null,
                        examDate = null,
                        name = null
                    )
                )
            }
            result.onSuccess { user ->
                AppState.setUser(user)
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

    var selectedGrade by remember { mutableStateOf(9) }
    var targetScore by remember { mutableStateOf(25) }

    val isOge = selectedGrade <= 9

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Spacer(Modifier.height(40.dp))

        Text(
            text = "Расскажи о себе",
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.foreground
        )
        Text(
            text = "Это поможет составить персональную программу",
            fontSize = 16.sp,
            color = colors.muted
        )

        Text(
            text = "Какой экзамен сдаёшь?",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.foreground
        )

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            GradeChip(
                label = "ОГЭ (9 класс)",
                selected = selectedGrade == 9,
                onClick = { selectedGrade = 9 },
                modifier = Modifier.weight(1f)
            )
            GradeChip(
                label = "ЕГЭ (11 класс)",
                selected = selectedGrade == 11,
                onClick = { selectedGrade = 11 },
                modifier = Modifier.weight(1f)
            )
        }

        Text(
            text = "Целевой балл",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.foreground
        )

        Text(
            text = "$targetScore ${if (isOge) "/ 32" else "/ 100"}",
            fontSize = 32.sp,
            fontWeight = FontWeight.ExtraBold,
            color = AppAccent
        )

        Slider(
            value = targetScore.toFloat(),
            onValueChange = { targetScore = it.toInt() },
            valueRange = if (isOge) 15f..32f else 50f..100f,
            steps = if (isOge) 16 else 49,
            colors = SliderDefaults.colors(
                thumbColor = AppAccent,
                activeTrackColor = AppAccent,
                inactiveTrackColor = colors.border
            )
        )

        val hint = when {
            isOge && targetScore >= 30 -> "Отлично! Нацелен на 5 по ОГЭ"
            isOge && targetScore >= 25 -> "Хорошо! Это 4 по ОГЭ"
            isOge -> "Базовый уровень — 3 по ОГЭ"
            !isOge && targetScore >= 80 -> "Отлично! Топовый уровень ЕГЭ"
            !isOge && targetScore >= 60 -> "Хороший балл для поступления"
            else -> "Можем улучшить! Давай начнём"
        }

        Text(
            text = hint,
            fontSize = 14.sp,
            color = colors.muted
        )

        error?.let {
            Text(text = it, color = AppDanger, fontSize = 14.sp)
        }

        Spacer(Modifier.height(8.dp))

        PrimaryButton(
            text = "Начать диагностику",
            onClick = { vm.save(selectedGrade, targetScore, onDone) },
            loading = loading
        )
    }
}

@Composable
private fun GradeChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalAppColors.current
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) AppAccent else colors.surface)
            .border(
                width = 2.dp,
                color = if (selected) AppAccent else colors.border,
                shape = RoundedCornerShape(12.dp)
            )
            .clickable { onClick() }
            .padding(vertical = 16.dp, horizontal = 12.dp)
    ) {
        Text(
            text = label,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = if (selected) dev.squad52.android_edutech.ui.theme.AppAccentFg else colors.foreground
        )
    }
}

