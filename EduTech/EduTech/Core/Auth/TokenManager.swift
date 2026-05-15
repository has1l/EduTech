import Foundation

actor TokenManager {
    static let shared = TokenManager()

    private static let accessKey = "access_token"
    private static let refreshKey = "refresh_token"

    private var refreshTask: Task<Void, Error>?

    var accessToken: String? { KeychainStore.get(Self.accessKey) }
    var refreshToken: String? { KeychainStore.get(Self.refreshKey) }
    var isAuthenticated: Bool { accessToken != nil }

    func setTokens(_ pair: TokenPair) {
        KeychainStore.set(pair.accessToken, for: Self.accessKey)
        KeychainStore.set(pair.refreshToken, for: Self.refreshKey)
    }

    func clear() {
        KeychainStore.delete(Self.accessKey)
        KeychainStore.delete(Self.refreshKey)
    }

    /// Triggers a single concurrent refresh; coalesces overlapping callers.
    func refresh() async throws {
        if let task = refreshTask {
            try await task.value
            return
        }
        let task = Task { try await performRefresh() }
        refreshTask = task
        defer { refreshTask = nil }
        try await task.value
    }

    private func performRefresh() async throws {
        guard let refresh = refreshToken else { throw APIError.unauthorized }
        let pair: TokenPair = try await APIClient.shared.request(.refresh(refreshToken: refresh))
        setTokens(pair)
    }
}
