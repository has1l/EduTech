import Foundation

// MARK: - User & Auth

struct User: Decodable, Identifiable, Hashable {
    let id: UUID
    let email: String
    let name: String?
    let grade: Int?
    let currentScore: Int?
    let ogeCurrentScore: Int?
    let targetScore: Int?
    let examDate: String?
    let diagnosticCompletedAt: String?
    let ogeDiagnosticCompletedAt: String?

    var isOge: Bool { (grade ?? 11) <= 9 }

    var activeDiagnosticCompletedAt: String? {
        isOge ? ogeDiagnosticCompletedAt : diagnosticCompletedAt
    }
}

struct TokenPair: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
}

struct AuthResponse: Decodable {
    let user: User
    let tokens: TokenPair
    let needsOnboarding: Bool
}

// MARK: - Tasks

struct TaskOption: Decodable, Hashable, Identifiable {
    let id: String
    let text: String
}

struct EduTask: Decodable, Identifiable, Hashable {
    let id: UUID
    let topicId: UUID
    let type: String
    let questionText: String
    let questionImageUrl: String?
    let options: [TaskOption]?
    let difficulty: Int
}

struct AnswerResult: Decodable {
    let correct: Bool
    let dialogueId: UUID?
}

struct TodaySession: Decodable {
    let sessionId: UUID
    let tasks: [EduTask]
}

struct SubtopicSession: Decodable {
    let tasks: [EduTask]
}

// MARK: - Session path

enum NodeState: String, Decodable {
    case completed, current, locked
}

struct PathNode: Decodable, Hashable, Identifiable {
    let topicId: UUID
    let title: String
    let subtopicNumber: String
    let taskNumber: Int
    let state: NodeState
    let attemptsCount: Int
    let correctCount: Int

    var id: UUID { topicId }
}

struct TaskSection: Decodable, Identifiable, Hashable {
    let taskNumber: Int
    let title: String
    let difficulty: Int
    let nodes: [PathNode]

    var id: Int { taskNumber }
}

struct SessionPath: Decodable {
    let sections: [TaskSection]
}

// MARK: - Streak

struct Streak: Decodable {
    let currentStreak: Int
    let longestStreak: Int
    let lastSessionDate: String?
    let freezesAvailable: Int
}

// MARK: - Score prediction

struct ScorePrediction: Decodable {
    let target: Int
    let byPlan: Int
    let ifNothing: Int
    let explanation: String
    let maxPossible: Int
    let isOge: Bool
}

// MARK: - Booster & KB

struct BoosterItem: Decodable, Identifiable, Hashable {
    let taskId: UUID
    let topicId: UUID?
    let reason: String
    let questionPreview: String
    let addedAt: String

    var id: UUID { taskId }
}

struct BoosterCount: Decodable { let count: Int }

struct KBStats: Decodable {
    let count: Int
    let levelName: String
    let levelEmoji: String
    let nextAt: Int?
    let levelMin: Int
    let levelPct: Double
}

// MARK: - Study plan

enum PlanStatus: String, Decodable {
    case weak, medium, strong
}

struct PlanGroup: Decodable, Identifiable, Hashable {
    let taskNumber: Int
    let title: String
    let priority: Int
    let why: String
    let status: PlanStatus
    let masteryPct: Int

    var id: Int { taskNumber }
}

struct StudyPlan: Decodable {
    let summary: String
    let groups: [PlanGroup]
    let generatedAt: String
}

struct PlanOut: Decodable {
    let plan: StudyPlan?
    let needsGeneration: Bool
}

// MARK: - Diagnostic

struct DiagnosticSession: Decodable {
    let sessionId: String   // "diag:<user_id>:<hex8>" — not a UUID
    let tasks: [EduTask]
}

struct DiagnosticSectionResult: Decodable, Hashable, Identifiable {
    let taskNumber: Int
    let title: String
    let difficulty: Int
    let isCorrect: Bool
    let correctAnswer: String
    let topicTitle: String

    var id: Int { taskNumber }
}

struct DiagnosticResult: Decodable {
    let total: Int
    let correct: Int
    let sections: [DiagnosticSectionResult]
}

// MARK: - Dialogue

struct DialogueMessage: Decodable, Identifiable, Hashable {
    let role: String
    let content: String
    var theoryRef: TheoryRef?

    var id: String { "\(role):\(content.hashValue)" }
}

struct TheoryRef: Decodable, Hashable {
    let title: String?
    let sectionId: String?
}

struct DialogueState: Decodable {
    let id: UUID
    var messages: [DialogueMessage]
    let hintLevel: Int
    let resolved: Bool
}

struct GiveUpResponse: Decodable {
    let correctAnswer: String
}
