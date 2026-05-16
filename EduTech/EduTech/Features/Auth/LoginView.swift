import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @Environment(AppState.self) private var appState

    @State private var mode: AuthMode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var yandexLoading = false
    @State private var errorMessage: String?
    @FocusState private var focused: AuthField?

    var body: some View {
        ZStack {
            Color.appBg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 60)

                    logoSection

                    Spacer().frame(height: 40)

                    modePicker
                        .padding(.horizontal, 24)

                    Spacer().frame(height: 28)

                    formSection
                        .padding(.horizontal, 24)

                    if !Config.yandexClientId.isEmpty {
                        Spacer().frame(height: 24)
                        orDivider.padding(.horizontal, 24)
                        Spacer().frame(height: 24)
                        yandexButton.padding(.horizontal, 24)
                    }

                    Spacer().frame(height: 60)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    // MARK: - Logo

    private var logoSection: some View {
        VStack(spacing: 12) {
            Circle()
                .fill(Color.appAccent)
                .frame(width: 72, height: 72)
                .overlay {
                    Image(systemName: "sparkles")
                        .font(.system(size: 34, weight: .black))
                        .foregroundStyle(Color.appAccentFg)
                }
            Text("EduTech")
                .font(.system(size: 36, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appFg)
            Text("AI-репетитор по ОГЭ и ЕГЭ")
                .font(.subheadline)
                .foregroundStyle(Color.appMuted)
        }
    }

    // MARK: - Mode picker

    private var modePicker: some View {
        HStack(spacing: 0) {
            modePill("Войти", .login)
            modePill("Регистрация", .register)
        }
        .padding(4)
        .background(Color.appBorder.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func modePill(_ title: String, _ target: AuthMode) -> some View {
        let active = mode == target
        return Button {
            withAnimation(.spring(duration: 0.25)) {
                mode = target
                errorMessage = nil
            }
        } label: {
            Text(title)
                .font(.subheadline.bold())
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(active ? Color.appBg : Color.clear)
                .foregroundStyle(active ? Color.appFg : Color.appMuted)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .shadow(color: active ? Color.black.opacity(0.08) : .clear, radius: 4, y: 2)
        }
        .buttonStyle(.plain)
        .animation(.spring(duration: 0.25), value: active)
    }

    // MARK: - Form

    private var formSection: some View {
        VStack(spacing: 14) {
            TextField("Email", text: $email)
                .keyboardType(.emailAddress)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .focused($focused, equals: .email)
                .fieldStyle()

            SecureField("Пароль", text: $password)
                .focused($focused, equals: .password)
                .fieldStyle()

            if let err = errorMessage {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(Color.appDanger)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
            }

            PrimaryButton(
                title: mode == .login ? "Войти" : "Зарегистрироваться",
                isLoading: isLoading,
                disabled: email.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty
            ) {
                Task { await submit() }
            }
        }
    }

    // MARK: - Yandex

    private var orDivider: some View {
        HStack {
            Rectangle().fill(Color.appBorder).frame(height: 1)
            Text("или")
                .font(.caption)
                .foregroundStyle(Color.appMuted)
                .padding(.horizontal, 10)
            Rectangle().fill(Color.appBorder).frame(height: 1)
        }
    }

    private var yandexButton: some View {
        Button {
            Task { await loginYandex() }
        } label: {
            HStack(spacing: 10) {
                if yandexLoading {
                    ProgressView().tint(Color.appFg)
                } else {
                    Image(systemName: "person.crop.circle.badge.checkmark")
                        .font(.body.bold())
                    Text("Войти через Яндекс ID")
                        .font(.body.bold())
                }
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(Color.appBorder.opacity(0.3))
            .foregroundStyle(Color.appFg)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(isLoading || yandexLoading)
    }

    // MARK: - Actions

    private func submit() async {
        focused = nil
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            if mode == .login {
                try await appState.loginWithEmail(email: email.trimmingCharacters(in: .whitespaces), password: password)
            } else {
                try await appState.registerWithEmail(email: email.trimmingCharacters(in: .whitespaces), password: password)
            }
        } catch APIError.server(let status, let msg) {
            switch status {
            case 401: errorMessage = "Неверный email или пароль"
            case 409: errorMessage = "Этот email уже зарегистрирован"
            case 400: errorMessage = msg ?? "Проверь email и пароль"
            default:  errorMessage = msg ?? "Ошибка сервера (\(status))"
            }
        } catch APIError.unauthorized {
            errorMessage = "Неверный email или пароль"
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loginYandex() async {
        errorMessage = nil
        yandexLoading = true
        defer { yandexLoading = false }
        do {
            let code = try await YandexAuthSession.shared.authenticate()
            try await appState.loginWithYandex(code: code)
        } catch YandexAuthError.cancelled {
            // user dismissed sheet — no error shown
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Helpers

private enum AuthMode { case login, register }
private enum AuthField { case email, password }

private extension View {
    func fieldStyle() -> some View {
        self
            .padding(14)
            .background(Color.appBg)
            .overlay {
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(Color.appBorder, lineWidth: 1.5)
            }
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - Yandex OAuth

enum YandexAuthError: LocalizedError {
    case notConfigured
    case noCode
    case cancelled

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Яндекс ID не настроен"
        case .noCode:        return "Не удалось получить код авторизации"
        case .cancelled:     return nil
        }
    }
}

@MainActor
final class YandexAuthSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = YandexAuthSession()
    private var activeSession: ASWebAuthenticationSession?

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    func authenticate() async throws -> String {
        guard !Config.yandexClientId.isEmpty else { throw YandexAuthError.notConfigured }

        var comps = URLComponents(string: "https://oauth.yandex.ru/authorize")!
        comps.queryItems = [
            .init(name: "response_type", value: "code"),
            .init(name: "client_id",     value: Config.yandexClientId),
            .init(name: "redirect_uri",  value: Config.yandexRedirectUri),
            .init(name: "scope",         value: "login:info login:email"),
            .init(name: "state",         value: UUID().uuidString),
            .init(name: "force_confirm", value: "yes"),
        ]
        guard let url = comps.url else { throw YandexAuthError.notConfigured }

        return try await withCheckedThrowingContinuation { cont in
            let session = ASWebAuthenticationSession(
                url: url,
                callback: .customScheme("edutech")
            ) { [weak self] callbackURL, error in
                self?.activeSession = nil
                if let error {
                    let asErr = error as? ASWebAuthenticationSessionError
                    if asErr?.code == .canceledLogin {
                        cont.resume(throwing: YandexAuthError.cancelled)
                    } else {
                        cont.resume(throwing: error)
                    }
                } else if let cbURL = callbackURL,
                          let code = URLComponents(url: cbURL, resolvingAgainstBaseURL: false)?
                              .queryItems?.first(where: { $0.name == "code" })?.value {
                    cont.resume(returning: code)
                } else {
                    cont.resume(throwing: YandexAuthError.noCode)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            activeSession = session
            session.start()
        }
    }
}
