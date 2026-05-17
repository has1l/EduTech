package dev.squad52.android_edutech.features.progress

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.KBStats
import dev.squad52.android_edutech.models.ScorePrediction
import dev.squad52.android_edutech.models.SessionPath
import dev.squad52.android_edutech.models.Streak
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ProgressUiState(
    val streak: Streak? = null,
    val prediction: ScorePrediction? = null,
    val kbStats: KBStats? = null,
    val path: SessionPath? = null,
    val isLoading: Boolean = true,
    val error: String? = null
)

class ProgressViewModel : ViewModel() {
    private val _state = MutableStateFlow(ProgressUiState())
    val state: StateFlow<ProgressUiState> = _state

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = ProgressUiState(isLoading = true)
            val streakResult = ApiClient.safeCall { getStreak() }
            val predResult = ApiClient.safeCall { getScorePrediction() }
            val kbResult = ApiClient.safeCall { getKBStats() }
            val pathResult = ApiClient.safeCall { getPath() }

            _state.value = ProgressUiState(
                streak = streakResult.getOrNull(),
                prediction = predResult.getOrNull(),
                kbStats = kbResult.getOrNull(),
                path = pathResult.getOrNull(),
                isLoading = false,
                error = if (streakResult.isFailure && predResult.isFailure) "Ошибка загрузки" else null
            )
        }
    }
}
