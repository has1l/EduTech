package dev.squad52.android_edutech.models

data class User(
    val id: String,
    val email: String,
    val name: String?,
    val grade: Int?,
    val currentScore: Int?,
    val targetScore: Int?,
    val examDate: String?,
    val diagnosticCompletedAt: String?
)

data class TokenPair(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String
)

data class AuthResponse(
    val user: User,
    val tokens: TokenPair,
    val needsOnboarding: Boolean
)

data class TaskOption(
    val id: String,
    val text: String
)

data class EduTask(
    val id: String,
    val topicId: String,
    val type: String,
    val questionText: String,
    val questionImageUrl: String?,
    val options: List<TaskOption>?,
    val difficulty: Int
)

data class AnswerResult(
    val correct: Boolean,
    val dialogueId: String?
)

data class TodaySession(
    val sessionId: String,
    val tasks: List<EduTask>
)

data class SubtopicSession(
    val tasks: List<EduTask>
)

data class PathNode(
    val topicId: String,
    val title: String,
    val subtopicNumber: String,
    val taskNumber: Int,
    val state: String,
    val attemptsCount: Int,
    val correctCount: Int
)

data class TaskSection(
    val taskNumber: Int,
    val title: String,
    val difficulty: Int,
    val nodes: List<PathNode>
)

data class SessionPath(
    val sections: List<TaskSection>
)

data class Streak(
    val currentStreak: Int,
    val longestStreak: Int,
    val lastSessionDate: String?,
    val freezesAvailable: Int
)

data class ScorePrediction(
    val target: Int,
    val byPlan: Int,
    val ifNothing: Int,
    val explanation: String,
    val maxPossible: Int,
    val isOge: Boolean
)

data class BoosterItem(
    val taskId: String,
    val topicId: String?,
    val reason: String,
    val questionPreview: String,
    val addedAt: String
)

data class BoosterCount(
    val count: Int
)

data class KBStats(
    val count: Int,
    val levelName: String,
    val levelEmoji: String,
    val nextAt: Int?,
    val levelMin: Int,
    val levelPct: Double
)

data class PlanGroup(
    val taskNumber: Int,
    val title: String,
    val priority: Int,
    val why: String,
    val status: String,
    val masteryPct: Int
)

data class StudyPlan(
    val summary: String,
    val groups: List<PlanGroup>,
    val generatedAt: String
)

data class PlanOut(
    val plan: StudyPlan?,
    val needsGeneration: Boolean
)

data class DiagnosticSession(
    val sessionId: String,
    val tasks: List<EduTask>
)

data class DiagnosticSectionResult(
    val taskNumber: Int,
    val title: String,
    val difficulty: Int,
    val isCorrect: Boolean,
    val correctAnswer: String,
    val topicTitle: String
)

data class DiagnosticResult(
    val total: Int,
    val correct: Int,
    val sections: List<DiagnosticSectionResult>
)

data class TheoryRef(
    val title: String?,
    val sectionId: String?
)

data class DialogueMessage(
    val role: String,
    val content: String,
    val theoryRef: TheoryRef?
)

data class GiveUpResponse(
    val correctAnswer: String
)

data class DialogueFull(
    val id: String,
    val messages: List<DialogueMessage>,
    val resolved: Boolean,
    val hintLevel: Int
)

data class AddToBoosterRequest(
    val taskId: String,
    val topicId: String?,
    val reason: String,
    val questionPreview: String
)

data class ReasonRequest(val reason: String)

data class TextRequest(val text: String)

data class AnswerRequest(val answer: String)

data class RefreshRequest(val refreshToken: String)

data class LoginRequest(val email: String, val password: String)

data class RegisterRequest(val email: String, val password: String)

data class UpdateProfileRequest(
    val grade: Int?,
    val currentScore: Int?,
    val targetScore: Int?,
    val examDate: String?,
    val name: String?
)

data class DiagnosticAnswerItem(val taskId: String, val answer: String)

data class DiagnosticSubmitRequest(val sessionId: String, val answers: List<DiagnosticAnswerItem>)
