package dev.squad52.android_edutech.features.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.ui.components.PrimaryButton
import dev.squad52.android_edutech.ui.theme.*

@Composable
fun ProfileScreen(vm: ProfileViewModel = viewModel()) {
    val user by AppState.currentUser.collectAsState()
    val editState by vm.editState.collectAsState()
    val colors = LocalAppColors.current

    val initial = user?.name?.firstOrNull()?.uppercaseChar()
        ?: user?.email?.firstOrNull()?.uppercaseChar()
        ?: '?'

    val isOge = editState.grade <= 9

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Avatar
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(72.dp)
                .background(AppAccent, CircleShape)
                .align(Alignment.CenterHorizontally)
        ) {
            Text(
                text = initial.toString(),
                fontSize = 32.sp,
                fontWeight = FontWeight.ExtraBold,
                color = AppAccentFg
            )
        }

        Text(
            text = user?.email ?: "",
            fontSize = 16.sp,
            color = colors.muted,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )

        // Stats strip
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.surface, RoundedCornerShape(12.dp))
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            ProfileStat("🔥", "Серия", AppState.currentUser.value?.let { "—" } ?: "—")
            ProfileStat("🏆", "Рекорд", "—")
            ProfileStat("❄️", "Заморозки", "—")
        }

        HorizontalDivider(color = colors.border)

        // Name
        Text("Имя", fontWeight = FontWeight.SemiBold, color = colors.muted, fontSize = 13.sp)
        OutlinedTextField(
            value = editState.name,
            onValueChange = vm::setName,
            placeholder = { Text("Твоё имя") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = AppAccent,
                unfocusedBorderColor = colors.border,
                focusedTextColor = colors.foreground,
                unfocusedTextColor = colors.foreground
            )
        )

        // Exam type
        Text("Экзамен", fontWeight = FontWeight.SemiBold, color = colors.muted, fontSize = 13.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            GradeChip("ОГЭ", editState.grade == 9, Modifier.weight(1f)) { vm.setGrade(9) }
            GradeChip("ЕГЭ", editState.grade == 11, Modifier.weight(1f)) { vm.setGrade(11) }
        }

        // Target score
        Text(
            "Целевой балл: ${editState.targetScore}",
            fontWeight = FontWeight.SemiBold,
            color = colors.muted,
            fontSize = 13.sp
        )
        Slider(
            value = editState.targetScore.toFloat(),
            onValueChange = { vm.setTargetScore(it.toInt()) },
            valueRange = if (isOge) 15f..32f else 50f..100f,
            steps = if (isOge) 16 else 49,
            colors = SliderDefaults.colors(
                thumbColor = AppAccent,
                activeTrackColor = AppAccent,
                inactiveTrackColor = colors.border
            )
        )

        editState.error?.let {
            Text(it, color = AppDanger, fontSize = 14.sp)
        }
        if (editState.saveSuccess) {
            Text("Сохранено!", color = AppSuccess, fontSize = 14.sp)
        }

        PrimaryButton(
            text = "Сохранить",
            onClick = vm::save,
            loading = editState.isSaving
        )

        PrimaryButton(
            text = "Выйти",
            onClick = vm::logout,
            color = AppDanger,
            textColor = Color.White
        )
    }
}

@Composable
private fun GradeChip(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val colors = LocalAppColors.current
    Button(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected) AppAccent else colors.surface,
            contentColor = if (selected) AppAccentFg else colors.foreground
        ),
        border = if (!selected) ButtonDefaults.outlinedButtonBorder else null
    ) {
        Text(label, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ProfileStat(icon: String, label: String, value: String) {
    val colors = LocalAppColors.current
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(icon, fontSize = 20.sp)
        Text(value, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = colors.foreground)
        Text(label, fontSize = 11.sp, color = colors.muted)
    }
}
