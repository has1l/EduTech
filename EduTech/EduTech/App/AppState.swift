import Foundation
import SwiftUI

@Observable
final class AppState {
    var currentUser: User?
    var isAuthenticating = false
    var bootstrapError: String?

    var isAuthenticated: Bool { currentUser != nil }
    var needsOnboarding: Bool {
        guard let u = currentUser else { return false }
        return u.grade == nil || u.targetScore == nil
    }
    var diagnosticDone: Bool {
        currentUser?.diagnosticCompletedAt != nil
    }

    /// On launch — auto-login via stored token, or silent anonymous register.
    func bootstrap() async {
        isAuthenticating = true
        defer { isAuthenticating = false }
        do {
            if await TokenManager.shared.isAuthenticated {
                try await fetchMe()
                return
            }
            try await silentRegister()
        } catch {
            bootstrapError = (error as? LocalizedError)?.errorDescription ?? "Не удалось войти"
        }
    }

    func fetchMe() async throws {
        let user: User = try await APIClient.shared.request(.me)
        currentUser = user
    }

    private func silentRegister() async throws {
        let email: String
        if let saved = AppDefaults.anonymousEmail {
            email = saved
        } else {
            email = "device_\(UUID().uuidString.prefix(12).lowercased())@anon.edutech.app"
            AppDefaults.anonymousEmail = email
        }
        let password = UUID().uuidString + UUID().uuidString
        KeychainStore.set(password, for: "anonymous_password")

        do {
            let resp: AuthResponse = try await APIClient.shared.request(.register(email: email, password: password))
            await TokenManager.shared.setTokens(resp.tokens)
            currentUser = resp.user
        } catch APIError.server(let status, _) where status == 409 || status == 400 {
            if let stored = KeychainStore.get("anonymous_password") {
                let resp: AuthResponse = try await APIClient.shared.request(.login(email: email, password: stored))
                await TokenManager.shared.setTokens(resp.tokens)
                currentUser = resp.user
            } else {
                throw APIError.unauthorized
            }
        }
    }

    func logout() async {
        await TokenManager.shared.clear()
        KeychainStore.deleteAll()
        AppDefaults.anonymousEmail = nil
        currentUser = nil
    }
}
