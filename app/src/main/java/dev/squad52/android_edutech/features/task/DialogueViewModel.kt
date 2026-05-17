package dev.squad52.android_edutech.features.task

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.core.network.SseClient
import dev.squad52.android_edutech.core.network.SseEvent
import dev.squad52.android_edutech.models.DialogueMessage
import dev.squad52.android_edutech.models.TextRequest
import dev.squad52.android_edutech.models.TheoryRef
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ChatMessage(
    val role: String,
    val content: String,
    val theoryRef: TheoryRef? = null,
    val isStreaming: Boolean = false
)

data class DialogueUiState(
    val messages: List<ChatMessage> = emptyList(),
    val isStreaming: Boolean = false,
    val isLoading: Boolean = false,
    val hintLevel: Int = 1,
    val error: String? = null,
    val resolved: Boolean = false
)

class DialogueViewModel : ViewModel() {
    private val _state = MutableStateFlow(DialogueUiState())
    val state: StateFlow<DialogueUiState> = _state

    fun loadAndStream(dialogueId: String) {
        if (_state.value.isStreaming || _state.value.messages.isNotEmpty()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            val existingResult = ApiClient.safeCall { getDialogue(dialogueId) }
            existingResult.onSuccess { dialogue ->
                val msgs = dialogue.messages.map { m ->
                    ChatMessage(m.role, m.content, m.theoryRef)
                }
                _state.value = _state.value.copy(
                    messages = msgs,
                    isLoading = false,
                    resolved = dialogue.resolved,
                    hintLevel = dialogue.hintLevel
                )
                if (!dialogue.resolved && msgs.isEmpty()) {
                    startStream(dialogueId)
                }
            }.onFailure {
                _state.value = _state.value.copy(isLoading = false)
                startStream(dialogueId)
            }
        }
    }

    private fun startStream(dialogueId: String) {
        viewModelScope.launch {
            val streamingMsg = ChatMessage("assistant", "", isStreaming = true)
            _state.value = _state.value.copy(
                messages = _state.value.messages + streamingMsg,
                isStreaming = true
            )
            var builtText = ""
            var lastTheoryRef: TheoryRef? = null

            SseClient.stream(dialogueId).collect { event ->
                when (event) {
                    is SseEvent.Token -> {
                        builtText += event.text
                        val updatedMessages = _state.value.messages.toMutableList()
                        val lastIdx = updatedMessages.lastIndex
                        if (lastIdx >= 0) {
                            updatedMessages[lastIdx] = updatedMessages[lastIdx].copy(content = builtText)
                        }
                        _state.value = _state.value.copy(messages = updatedMessages)
                    }
                    is SseEvent.Meta -> {
                        try {
                            val gson = com.google.gson.GsonBuilder()
                                .setFieldNamingPolicy(com.google.gson.FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
                                .create()
                            val meta = gson.fromJson(event.raw, MetaPayload::class.java)
                            lastTheoryRef = meta.theoryRef
                            _state.value = _state.value.copy(
                                hintLevel = meta.hintLevel ?: _state.value.hintLevel
                            )
                        } catch (_: Exception) {}
                    }
                    is SseEvent.Done -> {
                        val updatedMessages = _state.value.messages.toMutableList()
                        val lastIdx = updatedMessages.lastIndex
                        if (lastIdx >= 0) {
                            updatedMessages[lastIdx] = updatedMessages[lastIdx].copy(
                                isStreaming = false,
                                theoryRef = lastTheoryRef
                            )
                        }
                        _state.value = _state.value.copy(
                            messages = updatedMessages,
                            isStreaming = false
                        )
                    }
                    is SseEvent.Error -> {
                        _state.value = _state.value.copy(
                            isStreaming = false,
                            error = event.message
                        )
                    }
                }
            }
        }
    }

    fun sendReply(dialogueId: String, text: String) {
        if (_state.value.isStreaming) return
        val userMsg = ChatMessage("user", text)
        _state.value = _state.value.copy(messages = _state.value.messages + userMsg)
        viewModelScope.launch {
            ApiClient.safeCall { dialogueReply(dialogueId, TextRequest(text)) }
            startStream(dialogueId)
        }
    }

    private data class MetaPayload(
        val theoryRef: TheoryRef?,
        val hintLevel: Int?
    )
}
