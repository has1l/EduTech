package dev.squad52.android_edutech.core.network

import dev.squad52.android_edutech.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // Auth
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): Response<AuthResponse>

    // Users
    @GET("users/me")
    suspend fun getMe(): Response<User>

    @PATCH("users/me")
    suspend fun updateMe(@Body body: UpdateProfileRequest): Response<User>

    // Diagnostic
    @POST("diagnostic/start")
    suspend fun startDiagnostic(): Response<DiagnosticSession>

    @POST("diagnostic/submit")
    suspend fun submitDiagnostic(@Body body: DiagnosticSubmitRequest): Response<DiagnosticResult>

    // Sessions
    @GET("sessions/today")
    suspend fun getToday(): Response<TodaySession>

    @POST("sessions/{id}/complete")
    suspend fun completeSession(@Path("id") id: String): Response<Unit>

    @GET("sessions/path")
    suspend fun getPath(): Response<SessionPath>

    @POST("sessions/reset-path")
    suspend fun resetPath(): Response<Unit>

    // Tasks
    @GET("tasks/{id}")
    suspend fun getTask(@Path("id") id: String): Response<EduTask>

    @POST("tasks/{id}/answer")
    suspend fun answerTask(@Path("id") id: String, @Body body: AnswerRequest): Response<AnswerResult>

    @GET("tasks/subtopic-session")
    suspend fun getSubtopicSession(
        @Query("topic_id") topicId: String,
        @Query("count") count: Int = 5
    ): Response<SubtopicSession>

    // Dialogue
    @POST("dialogue/{id}/reply")
    suspend fun dialogueReply(
        @Path("id") id: String,
        @Body body: TextRequest
    ): Response<Unit>

    @GET("dialogue/{id}")
    suspend fun getDialogue(@Path("id") id: String): Response<DialogueFull>

    @POST("dialogue/{id}/give-up")
    suspend fun giveUp(@Path("id") id: String): Response<GiveUpResponse>

    // Streak
    @GET("streak")
    suspend fun getStreak(): Response<Streak>

    @POST("streak/record")
    suspend fun recordStreak(): Response<Streak>

    // Progress
    @GET("progress/score-prediction")
    suspend fun getScorePrediction(): Response<ScorePrediction>

    // Plan
    @GET("plan")
    suspend fun getPlan(): Response<PlanOut>

    @POST("plan/generate")
    suspend fun generatePlan(): Response<StudyPlan>

    // Booster
    @GET("booster")
    suspend fun getBooster(): Response<List<BoosterItem>>

    @GET("booster/count")
    suspend fun getBoosterCount(): Response<BoosterCount>

    @POST("booster")
    suspend fun addToBooster(@Body body: AddToBoosterRequest): Response<Unit>

    @DELETE("booster/{task_id}")
    suspend fun removeFromBooster(@Path("task_id") taskId: String): Response<Unit>

    @PATCH("booster/{task_id}/reason")
    suspend fun updateBoosterReason(
        @Path("task_id") taskId: String,
        @Body body: ReasonRequest
    ): Response<Unit>

    // Knowledge base
    @GET("kb/stats")
    suspend fun getKBStats(): Response<KBStats>

    @POST("kb")
    suspend fun addToKB(@Body body: Map<String, String?>): Response<Unit>

    @POST("kb/clear")
    suspend fun clearKB(): Response<Unit>
}
