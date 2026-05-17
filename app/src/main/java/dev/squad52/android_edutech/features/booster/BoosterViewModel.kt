package dev.squad52.android_edutech.features.booster

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.BoosterItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class BoosterUiState(
    val items: List<BoosterItem> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

class BoosterViewModel : ViewModel() {
    private val _state = MutableStateFlow(BoosterUiState(isLoading = true))
    val state: StateFlow<BoosterUiState> = _state

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = ApiClient.safeCall { getBooster() }
            result.onSuccess { items ->
                _state.value = BoosterUiState(items = items)
            }.onFailure { e ->
                _state.value = BoosterUiState(error = e.message)
            }
        }
    }

    fun remove(taskId: String) {
        viewModelScope.launch {
            ApiClient.safeCall { removeFromBooster(taskId) }
            _state.value = _state.value.copy(
                items = _state.value.items.filter { it.taskId != taskId }
            )
            AppState.refreshBoosterCount()
        }
    }

    fun groupedByTaskNumber(): Map<String, List<BoosterItem>> {
        return _state.value.items.groupBy { item ->
            item.topicId?.substringBefore("_") ?: "Прочее"
        }
    }
}
