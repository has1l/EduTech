package dev.squad52.android_edutech.core

import dev.squad52.android_edutech.core.auth.TokenStore
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.User
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

object AppState {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser

    private val _boosterCount = MutableStateFlow(0)
    val boosterCount: StateFlow<Int> = _boosterCount

    private val _isBootstrapped = MutableStateFlow(false)
    val isBootstrapped: StateFlow<Boolean> = _isBootstrapped

    private val _showLoginFlow = MutableStateFlow(false)
    val showLoginFlow: StateFlow<Boolean> = _showLoginFlow

    private val _pendingDiagnostic = MutableStateFlow(false)
    val pendingDiagnostic: StateFlow<Boolean> = _pendingDiagnostic

    fun setPendingDiagnostic(value: Boolean) {
        _pendingDiagnostic.value = value
    }

    fun bootstrap() {
        scope.launch {
            if (!TokenStore.hasTokens()) {
                _showLoginFlow.value = true
                _isBootstrapped.value = true
                return@launch
            }
            val result = ApiClient.safeCall { getMe() }
            result.onSuccess { user ->
                _currentUser.value = user
                _showLoginFlow.value = false
                refreshBoosterCount()
            }.onFailure {
                _showLoginFlow.value = true
            }
            _isBootstrapped.value = true
        }
    }

    fun setUser(user: User) {
        _currentUser.value = user
        _showLoginFlow.value = false
        scope.launch { refreshBoosterCount() }
    }

    fun logout() {
        TokenStore.clearTokens()
        _currentUser.value = null
        _showLoginFlow.value = true
        _boosterCount.value = 0
    }

    fun refreshBoosterCount() {
        scope.launch {
            val result = ApiClient.safeCall { getBoosterCount() }
            result.onSuccess { _boosterCount.value = it.count }
        }
    }

    fun needsOnboarding(): Boolean {
        val user = _currentUser.value ?: return false
        return user.grade == null || user.targetScore == null
    }
}
