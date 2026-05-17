package dev.squad52.android_edutech.core

import android.content.Context
import android.content.SharedPreferences

object AppDefaults {

    private const val PREFS_NAME = "edutech_defaults"
    private const val KEY_ONBOARDING_DONE = "onboarding_done"

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    var onboardingDone: Boolean
        get() = prefs.getBoolean(KEY_ONBOARDING_DONE, false)
        set(value) = prefs.edit().putBoolean(KEY_ONBOARDING_DONE, value).apply()
}
