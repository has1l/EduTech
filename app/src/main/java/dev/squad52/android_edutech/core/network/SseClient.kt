package dev.squad52.android_edutech.core.network

import dev.squad52.android_edutech.core.auth.TokenStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

sealed class SseEvent {
    data class Token(val text: String) : SseEvent()
    data class Meta(val raw: String) : SseEvent()
    object Done : SseEvent()
    data class Error(val message: String) : SseEvent()
}

object SseClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS) // infinite for SSE
        .build()

    fun stream(dialogueId: String): Flow<SseEvent> = flow {
        val token = TokenStore.getAccessToken()
        val url = "${ApiClient.BASE_URL}dialogue/$dialogueId/stream"

        val request = Request.Builder()
            .url(url)
            .addHeader("Accept", "text/event-stream")
            .apply { if (token != null) addHeader("Authorization", "Bearer $token") }
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) {
            emit(SseEvent.Error("HTTP ${response.code}"))
            return@flow
        }

        val source = response.body?.source() ?: run {
            emit(SseEvent.Error("No body"))
            return@flow
        }

        var currentEvent = ""
        var currentData = ""

        try {
            while (!source.exhausted()) {
                val line = source.readUtf8Line() ?: break

                when {
                    line.startsWith("event:") -> {
                        currentEvent = line.removePrefix("event:").trim()
                    }
                    line.startsWith("data:") -> {
                        currentData = line.removePrefix("data:").trim()
                    }
                    line.isEmpty() -> {
                        if (currentEvent.isNotEmpty() || currentData.isNotEmpty()) {
                            when (currentEvent) {
                                "token" -> {
                                    // Server sends json.dumps(string) e.g. "word" — decode as JSON string
                                    val text = try {
                                        com.google.gson.JsonParser.parseString(currentData)
                                            .asString
                                    } catch (_: Exception) {
                                        currentData
                                    }
                                    emit(SseEvent.Token(text))
                                }
                                "meta" -> emit(SseEvent.Meta(currentData))
                                "done" -> emit(SseEvent.Done)
                                "error" -> emit(SseEvent.Error(currentData))
                            }
                            currentEvent = ""
                            currentData = ""
                        }
                    }
                }
            }
        } finally {
            response.close()
        }
    }.flowOn(Dispatchers.IO)
}
