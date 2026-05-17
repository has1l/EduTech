package dev.squad52.android_edutech.core.network

import com.google.gson.FieldNamingPolicy
import com.google.gson.GsonBuilder
import dev.squad52.android_edutech.core.auth.TokenStore
import dev.squad52.android_edutech.models.LoginRequest
import dev.squad52.android_edutech.models.RefreshRequest
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    const val BASE_URL = "https://edutech-production-3cad.up.railway.app/api/v1/"

    private val gson = GsonBuilder()
        .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
        .create()

    private val authInterceptor = Interceptor { chain ->
        val token = TokenStore.getAccessToken()
        val request = if (token != null) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        chain.proceed(request)
    }

    private val refreshInterceptor = Interceptor { chain ->
        val response = chain.proceed(chain.request())
        if (response.code == 401) {
            response.close()
            val refreshed = runBlocking { tryRefresh() }
            if (refreshed) {
                val newToken = TokenStore.getAccessToken()
                val newRequest = chain.request().newBuilder()
                    .header("Authorization", "Bearer $newToken")
                    .build()
                chain.proceed(newRequest)
            } else {
                TokenStore.clearTokens()
                response
            }
        } else {
            response
        }
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(refreshInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    val api: ApiService = retrofit.create(ApiService::class.java)

    private suspend fun tryRefresh(): Boolean {
        val refreshToken = TokenStore.getRefreshToken() ?: return false
        return try {
            val freshClient = OkHttpClient.Builder()
                .addInterceptor(loggingInterceptor)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .build()
            val freshRetrofit = Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(freshClient)
                .addConverterFactory(GsonConverterFactory.create(gson))
                .build()
            val freshApi = freshRetrofit.create(ApiService::class.java)
            val resp = freshApi.refresh(RefreshRequest(refreshToken))
            if (resp.isSuccessful) {
                val body = resp.body()!!
                TokenStore.saveTokens(body.tokens.accessToken, body.tokens.refreshToken)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    suspend fun <T> safeCall(block: suspend ApiService.() -> retrofit2.Response<T>): Result<T> {
        return try {
            val response = block(api)
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) {
                    Result.success(body)
                } else if (response.code() == 204) {
                    @Suppress("UNCHECKED_CAST")
                    Result.success(Unit as T)
                } else {
                    Result.failure(ApiException(response.code(), ApiError(detail = "Empty response")))
                }
            } else {
                val errorBody = response.errorBody()?.string()
                val apiError = try {
                    gson.fromJson(errorBody, ApiError::class.java)
                } catch (e: Exception) {
                    ApiError(detail = errorBody ?: "Server error ${response.code()}")
                }
                Result.failure(ApiException(response.code(), apiError))
            }
        } catch (e: ApiException) {
            Result.failure(e)
        } catch (e: Exception) {
            Result.failure(ApiException(0, ApiError(detail = e.message ?: "Network error")))
        }
    }
}
