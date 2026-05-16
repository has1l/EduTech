import Foundation

enum Config {
    static let apiBaseURL = URL(string: "https://edutech-production-3cad.up.railway.app/api/v1")!

    // Yandex OAuth — fill in after registering the iOS app in Yandex OAuth console.
    // Leave empty to hide the "Войти через Яндекс ID" button.
    static let yandexClientId = "0edea57719a942578945a4f3fecf4d25"
    static let yandexRedirectUri = "edutech://auth/yandex/callback"
}
