import Foundation

enum AppDefaults {
    private static let defaults = UserDefaults.standard

    enum Key {
        static let anonymousEmail = "anonymous_email"
        static let dailyReminderHour = "daily_reminder_hour"
        static let dailyReminderMinute = "daily_reminder_minute"
        static let didOnboard = "did_onboard"
        static let lastKnownStreak = "last_known_streak"
        static let didShowSwipeHint = "did_show_swipe_hint"
        static let didShowDiagnosticSwipeHint = "did_show_diagnostic_swipe_hint"
    }

    static var didShowSwipeHint: Bool {
        get { defaults.bool(forKey: Key.didShowSwipeHint) }
        set { defaults.set(newValue, forKey: Key.didShowSwipeHint) }
    }

    static var didShowDiagnosticSwipeHint: Bool {
        get { defaults.bool(forKey: Key.didShowDiagnosticSwipeHint) }
        set { defaults.set(newValue, forKey: Key.didShowDiagnosticSwipeHint) }
    }

    static var anonymousEmail: String? {
        get { defaults.string(forKey: Key.anonymousEmail) }
        set { defaults.set(newValue, forKey: Key.anonymousEmail) }
    }

    static var lastKnownStreak: Int {
        get { defaults.integer(forKey: Key.lastKnownStreak) }
        set { defaults.set(newValue, forKey: Key.lastKnownStreak) }
    }

    static var dailyReminderTime: (hour: Int, minute: Int)? {
        get {
            guard defaults.object(forKey: Key.dailyReminderHour) != nil else { return nil }
            return (defaults.integer(forKey: Key.dailyReminderHour), defaults.integer(forKey: Key.dailyReminderMinute))
        }
        set {
            if let t = newValue {
                defaults.set(t.hour, forKey: Key.dailyReminderHour)
                defaults.set(t.minute, forKey: Key.dailyReminderMinute)
            } else {
                defaults.removeObject(forKey: Key.dailyReminderHour)
                defaults.removeObject(forKey: Key.dailyReminderMinute)
            }
        }
    }
}
