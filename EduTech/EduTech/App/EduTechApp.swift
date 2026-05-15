import SwiftUI

@main
struct EduTechApp: App {
    @State private var appState = AppState()
    @State private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .environment(router)
                .preferredColorScheme(nil)
                .task { await appState.bootstrap() }
        }
    }
}
