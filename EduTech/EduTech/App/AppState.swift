import Foundation
import SwiftUI

@Observable
final class AppState {
    var currentUser: User?
    var showLoginFlow = false
    var isAuthenticating = false
    var bootstrapError: String?
    var lastDiagnosticResult: DiagnosticResult?
    var boosterCount: Int = 0

    func fetchBoosterCount() async {
        if let c: BoosterCount = try? await APIClient.shared.request(.boosterCount) {
            boosterCount = c.count
        }
    }

    var isAuthenticated: Bool { currentUser != nil }
    var needsOnboarding: Bool {
        guard let u = currentUser else { return false }
        return u.grade == nil || u.targetScore == nil
    }
    var diagnosticDone: Bool {
        currentUser?.diagnosticCompletedAt != nil
    }

    /// On launch — restore session from keychain. If no token, show login.
    func bootstrap() async {
        isAuthenticating = true
        defer { isAuthenticating = false }
        do {
            if await TokenManager.shared.isAuthenticated {
                try await fetchMe()
            } else {
                showLoginFlow = true
            }
        } catch APIError.unauthorized {
            await TokenManager.shared.clear()
            showLoginFlow = true
        } catch {
            bootstrapError = (error as? LocalizedError)?.errorDescription ?? "Не удалось войти"
        }
    }

    func fetchMe() async throws {
        let user: User = try await APIClient.shared.request(.me)
        currentUser = user
        showLoginFlow = false
    }

    func loginWithEmail(email: String, password: String) async throws {
        let resp: AuthResponse = try await APIClient.shared.request(.login(email: email, password: password))
        await TokenManager.shared.setTokens(resp.tokens)
        currentUser = resp.user
        showLoginFlow = false
    }

    func registerWithEmail(email: String, password: String) async throws {
        let resp: AuthResponse = try await APIClient.shared.request(.register(email: email, password: password))
        await TokenManager.shared.setTokens(resp.tokens)
        currentUser = resp.user
        showLoginFlow = false
    }

    func loginWithYandex(code: String) async throws {
        let resp: AuthResponse = try await APIClient.shared.request(
            .yandexAuth(code: code, redirectUri: Config.yandexRedirectUri)
        )
        await TokenManager.shared.setTokens(resp.tokens)
        currentUser = resp.user
        showLoginFlow = false
    }

    func logout() async {
        await TokenManager.shared.clear()
        KeychainStore.deleteAll()
        AppDefaults.anonymousEmail = nil
        currentUser = nil
        showLoginFlow = true
    }
}
