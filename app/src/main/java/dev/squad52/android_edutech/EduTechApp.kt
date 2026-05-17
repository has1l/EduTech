package dev.squad52.android_edutech

import android.app.Application
import dev.squad52.android_edutech.core.AppDefaults
import dev.squad52.android_edutech.core.auth.TokenStore

class EduTechApp : Application() {
    override fun onCreate() {
        super.onCreate()
        TokenStore.init(this)
        AppDefaults.init(this)
    }
}
