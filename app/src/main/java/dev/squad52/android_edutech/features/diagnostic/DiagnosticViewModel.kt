package dev.squad52.android_edutech.features.diagnostic

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.DiagnosticAnswerItem
import dev.squad52.android_edutech.models.DiagnosticResult
import dev.squad52.android_edutech.models.DiagnosticSession
import dev.squad52.android_edutech.models.DiagnosticSubmitRequest
import dev.squad52.android_edutech.models.EduTask
import dev.squad52.android_edutech.models.UpdateProfileRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class DiagnosticUiState {
    object Intro : DiagnosticUiState()
    object Loading : DiagnosticUiState()
    data class Quiz(
        val session: DiagnosticSession,
        val answers: MutableMap<String, String> = mutableMapOf(),
        val currentPage: Int = 0
    ) : DiagnosticUiState()
    data class Result(val result: DiagnosticResult) : DiagnosticUiState()
    data class Error(val message: String) : DiagnosticUiState()
}

class DiagnosticViewModel : ViewModel() {
    private val _state = MutableStateFlow<DiagnosticUiState>(DiagnosticUiState.Intro)
    val state: StateFlow<DiagnosticUiState> = _state

    fun startDiagnostic() {
        viewModelScope.launch {
            _state.value = DiagnosticUiState.Loading
            val result = ApiClient.safeCall { startDiagnostic() }
            result.onSuccess { session ->
                _state.value = DiagnosticUiState.Quiz(session)
            }.onFailure { e ->
                _state.value = DiagnosticUiState.Error(e.message ?: "Ошибка")
            }
        }
    }

    fun setAnswer(taskId: String, answer: String) {
        val current = _state.value as? DiagnosticUiState.Quiz ?: return
        current.answers[taskId] = answer
        _state.value = current.copy()
    }

    fun nextPage() {
        val current = _state.value as? DiagnosticUiState.Quiz ?: return
        _state.value = current.copy(currentPage = current.currentPage + 1)
    }

    fun prevPage() {
        val current = _state.value as? DiagnosticUiState.Quiz ?: return
        if (current.currentPage > 0) {
            _state.value = current.copy(currentPage = current.currentPage - 1)
        }
    }

    fun submit() {
        val current = _state.value as? DiagnosticUiState.Quiz ?: return
        viewModelScope.launch {
            _state.value = DiagnosticUiState.Loading
            val answers = current.answers.map { (taskId, answer) ->
                DiagnosticAnswerItem(taskId, answer)
            }
            val result = ApiClient.safeCall {
                submitDiagnostic(DiagnosticSubmitRequest(current.session.sessionId, answers))
            }
            result.onSuccess { diagResult ->
                saveScore(diagResult)
                _state.value = DiagnosticUiState.Result(diagResult)
            }.onFailure { e ->
                _state.value = DiagnosticUiState.Error(e.message ?: "Ошибка отправки")
            }
        }
    }

    private fun saveScore(result: DiagnosticResult) {
        viewModelScope.launch {
            val user = AppState.currentUser.value ?: return@launch
            val isOge = user.isOge
            val pct = if (result.total > 0) result.correct.toFloat() / result.total else 0f
            val score = if (isOge) {
                when {
                    result.correct >= 9 -> 5
                    result.correct >= 4 -> 4
                    else -> 3
                }
            } else {
                when {
                    pct >= 0.75f -> 85
                    pct >= 0.55f -> 70
                    pct >= 0.30f -> 50
                    else -> 30
                }
            }
            val updated = ApiClient.safeCall {
                updateMe(UpdateProfileRequest(
                    grade = null,
                    currentScore = if (isOge) null else score,
                    ogeCurrentScore = if (isOge) score else null,
                    targetScore = null,
                    examDate = null,
                    name = null
                ))
            }
            updated.onSuccess { AppState.setUser(it) }
        }
    }
}
