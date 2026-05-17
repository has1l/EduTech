package dev.squad52.android_edutech.features.diagnostic

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.DiagnosticAnswerItem
import dev.squad52.android_edutech.models.DiagnosticResult
import dev.squad52.android_edutech.models.DiagnosticSession
import dev.squad52.android_edutech.models.DiagnosticSubmitRequest
import dev.squad52.android_edutech.models.EduTask
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
                _state.value = DiagnosticUiState.Result(diagResult)
            }.onFailure { e ->
                _state.value = DiagnosticUiState.Error(e.message ?: "Ошибка отправки")
            }
        }
    }
}
