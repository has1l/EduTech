package dev.squad52.android_edutech.ui.components

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.compose.ui.platform.LocalContext
import coil.ImageLoader
import dev.squad52.android_edutech.core.auth.TokenStore
import okhttp3.OkHttpClient
import okhttp3.Interceptor

@Composable
fun TaskImage(
    url: String,
    modifier: Modifier = Modifier
) {
    if (url.startsWith("data:")) {
        val base64Data = remember(url) {
            val commaIndex = url.indexOf(',')
            if (commaIndex >= 0) url.substring(commaIndex + 1) else url
        }
        val bitmap = remember(base64Data) {
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            } catch (e: Exception) {
                null
            }
        }
        bitmap?.let {
            Image(
                bitmap = it.asImageBitmap(),
                contentDescription = null,
                modifier = modifier.fillMaxWidth(),
                contentScale = ContentScale.FillWidth
            )
        }
    } else {
        val context = LocalContext.current
        val authInterceptor = Interceptor { chain ->
            val token = TokenStore.getAccessToken()
            val req = if (token != null) {
                chain.request().newBuilder()
                    .addHeader("Authorization", "Bearer $token")
                    .build()
            } else chain.request()
            chain.proceed(req)
        }
        val imageLoader = remember {
            ImageLoader.Builder(context)
                .okHttpClient(
                    OkHttpClient.Builder()
                        .addInterceptor(authInterceptor)
                        .build()
                )
                .build()
        }
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(url)
                .crossfade(true)
                .build(),
            imageLoader = imageLoader,
            contentDescription = null,
            modifier = modifier.fillMaxWidth(),
            contentScale = ContentScale.FillWidth
        )
    }
}
