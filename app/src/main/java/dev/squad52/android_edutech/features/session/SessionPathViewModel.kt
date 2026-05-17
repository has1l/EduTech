package dev.squad52.android_edutech.features.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.PlanOut
import dev.squad52.android_edutech.models.SessionPath
import dev.squad52.android_edutech.models.SubtopicSession
import dev.squad52.android_edutech.models.StudyPlan
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class PathUiState {
    object Loading : PathUiState()
    data class Success(val path: SessionPath) : PathUiState()
    data class Error(val message: String) : PathUiState()
}

sealed class PlanUiState {
    object Loading : PlanUiState()
    data class Success(val planOut: PlanOut) : PlanUiState()
    data class Error(val message: String) : PlanUiState()
}

class SessionPathViewModel : ViewModel() {
    private val _pathState = MutableStateFlow<PathUiState>(PathUiState.Loading)
    val pathState: StateFlow<PathUiState> = _pathState

    private val _planState = MutableStateFlow<PlanUiState>(PlanUiState.Loading)
    val planState: StateFlow<PlanUiState> = _planState

    private val _subtopicSession = MutableStateFlow<SubtopicSession?>(null)
    val subtopicSession: StateFlow<SubtopicSession?> = _subtopicSession

    private val _generatingPlan = MutableStateFlow(false)
    val generatingPlan: StateFlow<Boolean> = _generatingPlan

    init {
        loadPath()
        loadPlan()
    }

    fun loadPath() {
        viewModelScope.launch {
            _pathState.value = PathUiState.Loading
            val result = ApiClient.safeCall { getPath() }
            result.onSuccess { _pathState.value = PathUiState.Success(it) }
                .onFailure { _pathState.value = PathUiState.Error(it.message ?: "Ошибка") }
        }
    }

    fun loadPlan() {
        viewModelScope.launch {
            _planState.value = PlanUiState.Loading
            val result = ApiClient.safeCall { getPlan() }
            result.onSuccess { _planState.value = PlanUiState.Success(it) }
                .onFailure { _planState.value = PlanUiState.Error(it.message ?: "Ошибка") }
        }
    }

    fun generatePlan(onDone: () -> Unit) {
        viewModelScope.launch {
            _generatingPlan.value = true
            val result = ApiClient.safeCall { generatePlan() }
            _generatingPlan.value = false
            result.onSuccess { loadPlan() }
            onDone()
        }
    }

    fun loadSubtopicSession(topicId: String, onReady: (List<String>) -> Unit) {
        viewModelScope.launch {
            val result = ApiClient.safeCall { getSubtopicSession(topicId, 5) }
            result.onSuccess { session ->
                _subtopicSession.value = session
                onReady(session.tasks.map { it.id })
            }
        }
    }

    fun resetPath() {
        viewModelScope.launch {
            ApiClient.safeCall { resetPath() }
            loadPath()
        }
    }
}
