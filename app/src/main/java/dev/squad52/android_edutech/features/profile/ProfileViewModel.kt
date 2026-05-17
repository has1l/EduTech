package dev.squad52.android_edutech.features.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.squad52.android_edutech.core.AppState
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.UpdateProfileRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ProfileEditState(
    val grade: Int = 9,
    val targetScore: Int = 25,
    val name: String = "",
    val isSaving: Boolean = false,
    val saveSuccess: Boolean = false,
    val error: String? = null
)

class ProfileViewModel : ViewModel() {
    private val _editState = MutableStateFlow(ProfileEditState())
    val editState: StateFlow<ProfileEditState> = _editState

    init {
        val user = AppState.currentUser.value
        if (user != null) {
            _editState.value = ProfileEditState(
                grade = user.grade ?: 9,
                targetScore = user.targetScore ?: 25,
                name = user.name ?: ""
            )
        }
    }

    fun setGrade(grade: Int) {
        _editState.value = _editState.value.copy(grade = grade, saveSuccess = false)
    }

    fun setTargetScore(score: Int) {
        _editState.value = _editState.value.copy(targetScore = score, saveSuccess = false)
    }

    fun setName(name: String) {
        _editState.value = _editState.value.copy(name = name, saveSuccess = false)
    }

    fun save() {
        val s = _editState.value
        viewModelScope.launch {
            _editState.value = s.copy(isSaving = true, error = null, saveSuccess = false)
            val result = ApiClient.safeCall {
                updateMe(
                    UpdateProfileRequest(
                        grade = s.grade,
                        targetScore = s.targetScore,
                        currentScore = null,
                        examDate = null,
                        name = s.name.ifBlank { null }
                    )
                )
            }
            result.onSuccess { user ->
                AppState.setUser(user)
                _editState.value = _editState.value.copy(isSaving = false, saveSuccess = true)
            }.onFailure { e ->
                _editState.value = _editState.value.copy(isSaving = false, error = e.message)
            }
        }
    }

    fun logout() {
        AppState.logout()
    }
}
