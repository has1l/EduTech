import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(Router.self) private var router

    var body: some View {
        if appState.currentUser == nil {
            BootstrapView()
        } else if appState.needsOnboarding {
            OnboardingFlow()
        } else {
            MainTabsView()
        }
    }
}

private struct BootstrapView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.appBg, Color.appAccent.opacity(0.10)],
                startPoint: .top, endPoint: .bottom
            ).ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer()
                VStack(spacing: 10) {
                    Circle()
                        .fill(Color.appAccent)
                        .frame(width: 80, height: 80)
                        .overlay {
                            Image(systemName: "sparkles")
                                .font(.system(size: 40, weight: .black))
                                .foregroundStyle(Color.appAccentFg)
                        }
                    Text("EduTech")
                        .font(.system(size: 44, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color.appFg)
                    Text("AI-репетитор по ОГЭ и ЕГЭ")
                        .font(.subheadline)
                        .foregroundStyle(Color.appMuted)
                }
                Spacer()
                if let err = appState.bootstrapError {
                    VStack(spacing: 12) {
                        Text("Не получилось войти")
                            .font(.subheadline.bold())
                            .foregroundStyle(Color.appDanger)
                        Text(err)
                            .multilineTextAlignment(.center)
                            .font(.caption)
                            .foregroundStyle(Color.appMuted)
                        Button {
                            Task { await appState.bootstrap() }
                        } label: {
                            Text("Повторить")
                                .font(.headline)
                                .padding(.horizontal, 24)
                                .padding(.vertical, 12)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.appAccent)
                        .foregroundStyle(Color.appAccentFg)
                    }
                    .padding(20)
                    .padding(.horizontal, 16)
                } else {
                    ProgressView()
                        .controlSize(.large)
                        .tint(Color.appFg)
                }
                Spacer().frame(height: 80)
            }
        }
    }
}

struct MainTabsView: View {
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.rootTab) {
            Tab("Сегодня", systemImage: "sparkles", value: RootTab.home) {
                NavigationStack(path: $router.path) {
                    SessionPathView()
                        .navigationDestinationsForApp()
                }
            }
            Tab("Бустер", systemImage: "bolt.fill", value: RootTab.booster) {
                NavigationStack { BoosterListView().navigationDestinationsForApp() }
            }
            Tab("Прогресс", systemImage: "chart.line.uptrend.xyaxis", value: RootTab.progress) {
                NavigationStack { ProgressOverviewView().navigationDestinationsForApp() }
            }
            Tab("Профиль", systemImage: "person.crop.circle", value: RootTab.profile) {
                NavigationStack { ProfileView().navigationDestinationsForApp() }
            }
        }
        .tint(Color.appAccent)
    }
}

extension View {
    func navigationDestinationsForApp() -> some View {
        self.navigationDestination(for: Route.self) { route in
            switch route {
            case .onboarding: OnboardingFlow()
            case .diagnostic: DiagnosticView()
            case .diagnosticResult: DiagnosticResultView()
            case .sessionPath: SessionPathView()
            case .task(let id, let queue, let total, let all, let origin):
                TaskView(taskId: id, queue: queue, total: total, allIds: all, origin: origin)
            case .profile: ProfileView()
            case .progress: ProgressOverviewView()
            case .booster: BoosterListView()
            case .studyPlan: StudyPlanView()
            }
        }
    }
}
