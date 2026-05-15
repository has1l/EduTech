import Foundation
import SwiftUI

enum TaskOrigin: Hashable {
    case session
    case booster
    case review
    case diagnostic
}

enum Route: Hashable {
    case onboarding
    case diagnostic
    case diagnosticResult
    case sessionPath
    case task(id: UUID, queue: [UUID], total: Int, all: [UUID], origin: TaskOrigin)
    case profile
    case progress
    case booster
    case studyPlan
}

@Observable
final class Router {
    var path = NavigationPath()
    var rootTab: RootTab = .home

    func push(_ route: Route) { path.append(route) }
    func pop() { if !path.isEmpty { path.removeLast() } }
    func popToRoot() { path = NavigationPath() }
    func replace(with route: Route) {
        path = NavigationPath()
        path.append(route)
    }
}

enum RootTab: Hashable {
    case home, booster, progress, profile
}
