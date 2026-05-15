import Foundation
import UserNotifications

@MainActor
enum LocalNotificationManager {
    private static let identifier = "daily_streak_reminder"

    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    static func scheduleDaily(hour: Int, minute: Int) async {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard granted else { return }

        center.removePendingNotificationRequests(withIdentifiers: [identifier])

        var dc = DateComponents()
        dc.hour = hour
        dc.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)

        let content = UNMutableNotificationContent()
        content.title = "Не теряй серию 🔥"
        content.body = "Пять минут сегодня — и огонёк горит дальше"
        content.sound = .default

        let req = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        try? await center.add(req)

        AppDefaults.dailyReminderTime = (hour, minute)
    }

    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
        AppDefaults.dailyReminderTime = nil
    }
}
