package dev.squad52.android_edutech.features.task

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.squad52.android_edutech.core.network.ApiClient
import dev.squad52.android_edutech.models.AnswerRequest
import dev.squad52.android_edutech.models.EduTask
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

enum class TaskPhase {
    Loading, Question, Submitting, Correct, Wrong, Dialogue, GiveUp
}

data class TaskUiState(
    val phase: TaskPhase = TaskPhase.Loading,
    val task: EduTask? = null,
    val selectedAnswer: String? = null,
    val dialogueId: String? = null,
    val correctAnswer: String? = null,
    val error: String? = null
)

class TaskViewModel : ViewModel() {
    private val _states = mutableMapOf<String, MutableStateFlow<TaskUiState>>()

    fun stateFor(taskId: String): StateFlow<TaskUiState> {
        return _states.getOrPut(taskId) { MutableStateFlow(TaskUiState()) }
    }

    fun loadTask(taskId: String) {
        val flow = _states.getOrPut(taskId) { MutableStateFlow(TaskUiState()) }
        if (flow.value.phase != TaskPhase.Loading) return
        viewModelScope.launch {
            val result = ApiClient.safeCall { getTask(taskId) }
            result.onSuccess { task ->
                flow.value = TaskUiState(phase = TaskPhase.Question, task = task)
            }.onFailure { e ->
                flow.value = TaskUiState(phase = TaskPhase.Question, error = e.message)
            }
        }
    }

    fun submitAnswer(taskId: String, answer: String) {
        val flow = _states[taskId] ?: return
        val current = flow.value
        if (current.phase == TaskPhase.Submitting) return
        flow.value = current.copy(phase = TaskPhase.Submitting, selectedAnswer = answer)
        viewModelScope.launch {
            val result = ApiClient.safeCall { answerTask(taskId, AnswerRequest(answer)) }
            result.onSuccess { answerResult ->
                flow.value = if (answerResult.correct) {
                    current.copy(phase = TaskPhase.Correct, selectedAnswer = answer)
                } else {
                    current.copy(
                        phase = TaskPhase.Wrong,
                        selectedAnswer = answer,
                        dialogueId = answerResult.dialogueId
                    )
                }
            }.onFailure { e ->
                flow.value = current.copy(phase = TaskPhase.Question, error = e.message)
            }
        }
    }

    fun startDialogue(taskId: String) {
        val flow = _states[taskId] ?: return
        flow.value = flow.value.copy(phase = TaskPhase.Dialogue)
    }

    fun giveUp(taskId: String) {
        val flow = _states[taskId] ?: return
        val dialogueId = flow.value.dialogueId ?: return
        viewModelScope.launch {
            val result = ApiClient.safeCall { giveUp(dialogueId) }
            result.onSuccess { resp ->
                flow.value = flow.value.copy(
                    phase = TaskPhase.GiveUp,
                    correctAnswer = resp.correctAnswer
                )
            }
        }
    }

    fun markSolved(taskId: String) {
        _states[taskId]?.value = TaskUiState(phase = TaskPhase.Correct)
    }

    fun isSolved(taskId: String): Boolean {
        return _states[taskId]?.value?.phase == TaskPhase.Correct
    }

    fun isFailed(taskId: String): Boolean {
        val phase = _states[taskId]?.value?.phase
        return phase == TaskPhase.Wrong || phase == TaskPhase.Dialogue || phase == TaskPhase.GiveUp
    }
}
