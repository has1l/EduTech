import Foundation
import UserNotifications

@MainActor
enum LocalNotificationManager {
    private static let dailyId = "daily_streak_reminder"
    private static let repeatPrefix = "repeat_reminder_"
    private static let intervalHours: Double = 3

    private static let repeatMessages: [(title: String, body: String)] = [
        ("Не теряй серию 🔥", "Пять минут сегодня — и огонёк горит дальше"),
        ("Время для математики 📐", "Одна задача — и день засчитан"),
        ("Твой AI-репетитор ждёт 🤖", "Разберём ещё одну тему вместе"),
        ("Маленький шаг к ЕГЭ 🎯", "Реши пару задач прямо сейчас"),
        ("Серия не сгорит сама 🔥", "Зайди на 5 минут — это всё что нужно"),
        ("Сегодня ты можешь лучше 💪", "Открой новое задание и проверь себя"),
        ("Математика не ждёт 📊", "Твой прогресс обновляется каждый день"),
        ("Не откладывай на потом ⚡", "Три задачи — и можно отдыхать"),
    ]

    private static let streakLostMessages: [(title: String, body: String)] = [
        ("Серия сгорела 😢", "Но это не конец — начни новую прямо сейчас"),
        ("Огонёк потух 🕯️", "Дуолинго не сдавался, и ты не сдавайся"),
        ("0 дней подряд 💔", "Зато сейчас отличный момент начать заново"),
        ("Серия прервалась 😤", "Возвращайся — AI-репетитор уже ждёт"),
        ("Упс, пропустил день 😅", "Ничего страшного — важно продолжить"),
    ]

    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    // MARK: - Every N hours

    static func scheduleRepeating() async {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard granted else { return }

        // Remove old repeating notifications
        let old = (0..<messages.count * 3).map { "\(repeatPrefix)\($0)" }
        center.removePendingNotificationRequests(withIdentifiers: old)

        // Schedule 24 notifications (= 3 days at 3h interval), cycling through messages
        let intervalSec = intervalHours * 3600
        for i in 0..<24 {
            let msg = repeatMessages[i % repeatMessages.count]
            let content = UNMutableNotificationContent()
            content.title = msg.title
            content.body = msg.body
            content.sound = .default

            let delay = intervalSec * Double(i + 1)
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
            let req = UNNotificationRequest(identifier: "\(repeatPrefix)\(i)", content: content, trigger: trigger)
            try? await center.add(req)
        }
    }

    // MARK: - Streak lost

    static func notifyStreakLost(previousStreak: Int) async {
        guard previousStreak > 0 else { return }
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized else { return }

        let msg = streakLostMessages[Int.random(in: 0..<streakLostMessages.count)]
        let content = UNMutableNotificationContent()
        content.title = msg.title
        content.body = previousStreak > 1
            ? "Серия \(previousStreak) дней прервалась. \(msg.body)"
            : msg.body
        content.sound = .default

        // Fire after 10 seconds (immediate-ish, user just opened app)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 10, repeats: false)
        let req = UNNotificationRequest(identifier: "streak_lost", content: content, trigger: trigger)
        center.removePendingNotificationRequests(withIdentifiers: ["streak_lost"])
        try? await center.add(req)
    }

    static func cancelRepeating() {
        let ids = (0..<72).map { "\(repeatPrefix)\($0)" }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
    }

    // MARK: - Daily at specific time (kept for profile settings)

    static func scheduleDaily(hour: Int, minute: Int) async {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard granted else { return }

        center.removePendingNotificationRequests(withIdentifiers: [dailyId])

        var dc = DateComponents()
        dc.hour = hour
        dc.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)

        let content = UNMutableNotificationContent()
        content.title = "Не теряй серию 🔥"
        content.body = "Пять минут сегодня — и огонёк горит дальше"
        content.sound = .default

        let req = UNNotificationRequest(identifier: dailyId, content: content, trigger: trigger)
        try? await center.add(req)

        AppDefaults.dailyReminderTime = (hour, minute)
    }

    static func cancel() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [dailyId])
        cancelRepeating()
        AppDefaults.dailyReminderTime = nil
    }
}
