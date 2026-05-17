package dev.squad52.android_edutech.core.network

data class ApiError(
    val detail: String? = null,
    val message: String? = null
) {
    fun readable(): String = detail ?: message ?: "Неизвестная ошибка"
}

class ApiException(val code: Int, val error: ApiError) : Exception(error.readable())
