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
    case taskSession(allIds: [UUID], topicId: UUID?, origin: TaskOrigin, initialPage: Int)
    case profile
    case progress
    case booster
    case studyPlan
}

@Observable
final class Router {
    var path = NavigationPath()
    var boosterPath = NavigationPath()
    var rootTab: RootTab = .home

    func push(_ route: Route) {
        switch rootTab {
        case .booster: boosterPath.append(route)
        default: path.append(route)
        }
    }

    func pop() {
        switch rootTab {
        case .booster:
            if !boosterPath.isEmpty { boosterPath.removeLast() }
        default:
            if !path.isEmpty { path.removeLast() }
        }
    }

    func popToRoot() {
        switch rootTab {
        case .booster: boosterPath = NavigationPath()
        default: path = NavigationPath()
        }
    }

    func replace(with route: Route) {
        switch rootTab {
        case .booster:
            boosterPath = NavigationPath()
            boosterPath.append(route)
        default:
            path = NavigationPath()
            path.append(route)
        }
    }
}

enum RootTab: Hashable {
    case home, booster, progress, profile
}
