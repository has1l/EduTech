package dev.squad52.android_edutech.features.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.core.auth.TokenStore
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.LoginRequest
import dev.squad52.android_edutech.models.RegisterRequest
import dev.squad52.android_edutech.ui.components.PrimaryButton
import dev.squad52.android_edutech.ui.theme.AppAccent
import dev.squad52.android_edutech.ui.theme.AppDanger
import dev.squad52.android_edutech.ui.theme.LocalAppColors
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null
)

class AuthViewModel : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state

    fun login(email: String, password: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _state.value = AuthUiState(isLoading = true)
            val result = ApiClient.safeCall { login(LoginRequest(email, password)) }
            result.onSuccess { auth ->
                TokenStore.saveTokens(auth.tokens.accessToken, auth.tokens.refreshToken)
                AppState.setUser(auth.user)
                _state.value = AuthUiState()
                onSuccess()
            }.onFailure { e ->
                _state.value = AuthUiState(error = e.message)
            }
        }
    }

    fun register(email: String, password: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _state.value = AuthUiState(isLoading = true)
            val result = ApiClient.safeCall { register(RegisterRequest(email, password)) }
            result.onSuccess { auth ->
                TokenStore.saveTokens(auth.tokens.accessToken, auth.tokens.refreshToken)
                AppState.setUser(auth.user)
                _state.value = AuthUiState()
                onSuccess()
            }.onFailure { e ->
                _state.value = AuthUiState(error = e.message)
            }
        }
    }
}

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    vm: AuthViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val colors = LocalAppColors.current
    var isLogin by remember { mutableStateOf(true) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "⚡",
                fontSize = 64.sp
            )
            Text(
                text = "EduTech",
                fontSize = 32.sp,
                fontWeight = FontWeight.ExtraBold,
                color = AppAccent
            )
            Text(
                text = "Подготовка к ОГЭ/ЕГЭ",
                fontSize = 16.sp,
                color = colors.muted
            )

            Spacer(Modifier.height(16.dp))

            // Tab row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(colors.surface, RoundedCornerShape(12.dp))
                    .padding(4.dp)
            ) {
                TabButton("Войти", isLogin) { isLogin = true }
                TabButton("Регистрация", !isLogin) { isLogin = false }
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AppAccent,
                    focusedLabelColor = AppAccent,
                    unfocusedBorderColor = colors.border,
                    unfocusedTextColor = colors.foreground,
                    focusedTextColor = colors.foreground
                ),
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Пароль") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AppAccent,
                    focusedLabelColor = AppAccent,
                    unfocusedBorderColor = colors.border,
                    unfocusedTextColor = colors.foreground,
                    focusedTextColor = colors.foreground
                ),
                shape = RoundedCornerShape(12.dp)
            )

            state.error?.let { err ->
                Text(
                    text = err,
                    color = AppDanger,
                    fontSize = 14.sp
                )
            }

            PrimaryButton(
                text = if (isLogin) "Войти" else "Зарегистрироваться",
                onClick = {
                    if (isLogin) {
                        vm.login(email, password, onLoginSuccess)
                    } else {
                        vm.register(email, password, onLoginSuccess)
                    }
                },
                loading = state.isLoading,
                enabled = email.isNotBlank() && password.isNotBlank()
            )
        }
    }
}

@Composable
private fun RowScope.TabButton(text: String, selected: Boolean, onClick: () -> Unit) {
    val colors = LocalAppColors.current
    Button(
        onClick = onClick,
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected) AppAccent else colors.surface,
            contentColor = if (selected) dev.squad52.android_edutech.ui.theme.AppAccentFg else colors.muted
        ),
        elevation = ButtonDefaults.buttonElevation(0.dp, 0.dp)
    ) {
        Text(text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
    }
}
