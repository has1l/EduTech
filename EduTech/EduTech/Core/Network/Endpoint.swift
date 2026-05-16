import Foundation

enum HTTPMethod: String { case GET, POST, PATCH, DELETE, PUT }

struct Endpoint {
    let method: HTTPMethod
    let path: String
    let body: Encodable?
    let query: [URLQueryItem]
    let needsAuth: Bool

    init(_ method: HTTPMethod, _ path: String, body: Encodable? = nil, query: [URLQueryItem] = [], needsAuth: Bool = true) {
        self.method = method
        self.path = path
        self.body = body
        self.query = query
        self.needsAuth = needsAuth
    }
}

// MARK: - Endpoint catalog

extension Endpoint {
    // Auth
    static func register(email: String, password: String, name: String? = nil) -> Endpoint {
        struct Body: Encodable { let email: String; let password: String; let name: String? }
        return Endpoint(.POST, "/auth/register", body: Body(email: email, password: password, name: name), needsAuth: false)
    }
    static func login(email: String, password: String) -> Endpoint {
        struct Body: Encodable { let email: String; let password: String }
        return Endpoint(.POST, "/auth/login", body: Body(email: email, password: password), needsAuth: false)
    }
    static func refresh(refreshToken: String) -> Endpoint {
        struct Body: Encodable { let refresh_token: String }
        return Endpoint(.POST, "/auth/refresh", body: Body(refresh_token: refreshToken), needsAuth: false)
    }

    // Users
    static let me = Endpoint(.GET, "/users/me")
    static func updateMe(grade: Int?, currentScore: Int?, targetScore: Int?, examDate: String?, name: String?) -> Endpoint {
        struct Body: Encodable {
            let grade: Int?
            let current_score: Int?
            let target_score: Int?
            let exam_date: String?
            let name: String?
        }
        return Endpoint(.PATCH, "/users/me", body: Body(grade: grade, current_score: currentScore, target_score: targetScore, exam_date: examDate, name: name))
    }

    // Sessions
    static let todaySession = Endpoint(.GET, "/sessions/today")
    static let sessionPath = Endpoint(.GET, "/sessions/path")
    static let resetPath = Endpoint(.POST, "/sessions/reset-path", body: EmptyBody())

    // Tasks
    static func task(_ id: UUID) -> Endpoint { Endpoint(.GET, "/tasks/\(id.uuidString.lowercased())") }
    static func answer(_ id: UUID, answer: String) -> Endpoint {
        struct Body: Encodable { let answer: String }
        return Endpoint(.POST, "/tasks/\(id.uuidString.lowercased())/answer", body: Body(answer: answer))
    }
    static func subtopicSession(topicId: UUID, count: Int) -> Endpoint {
        Endpoint(.GET, "/tasks/subtopic-session", query: [
            .init(name: "topic_id", value: topicId.uuidString.lowercased()),
            .init(name: "count", value: String(count)),
        ])
    }

    // Dialogue
    static func dialogue(_ id: UUID) -> Endpoint { Endpoint(.GET, "/dialogue/\(id.uuidString.lowercased())") }
    static func dialogueReply(_ id: UUID, text: String) -> Endpoint {
        struct Body: Encodable { let text: String }
        return Endpoint(.POST, "/dialogue/\(id.uuidString.lowercased())/reply", body: Body(text: text))
    }
    static func dialogueGiveUp(_ id: UUID) -> Endpoint {
        Endpoint(.POST, "/dialogue/\(id.uuidString.lowercased())/give-up", body: EmptyBody())
    }

    // Diagnostic
    static let diagnosticStart = Endpoint(.POST, "/diagnostic/start", body: EmptyBody())
    static func diagnosticAnswer(taskId: UUID, answer: String, sessionId: UUID) -> Endpoint {
        struct Body: Encodable { let task_id: String; let answer: String; let session_id: String }
        return Endpoint(.POST, "/diagnostic/answer", body: Body(task_id: taskId.uuidString.lowercased(), answer: answer, session_id: sessionId.uuidString.lowercased()))
    }
    static func diagnosticSubmit(sessionId: UUID) -> Endpoint {
        struct Body: Encodable { let session_id: String }
        return Endpoint(.POST, "/diagnostic/submit", body: Body(session_id: sessionId.uuidString.lowercased()))
    }
    static let diagnosticResult = Endpoint(.GET, "/diagnostic/result")

    // Progress / streak / plan
    static let streak = Endpoint(.GET, "/streak")
    static let streakRecord = Endpoint(.POST, "/streak/record", body: EmptyBody())
    static let scorePrediction = Endpoint(.GET, "/progress/score-prediction")
    static let plan = Endpoint(.GET, "/plan")
    static let planGenerate = Endpoint(.POST, "/plan/generate", body: EmptyBody())

    // Booster
    static let booster = Endpoint(.GET, "/booster")
    static let boosterCount = Endpoint(.GET, "/booster/count")
    static func boosterAdd(taskId: UUID, topicId: UUID?, reason: String, questionPreview: String) -> Endpoint {
        struct Body: Encodable {
            let task_id: String
            let topic_id: String?
            let reason: String
            let question_preview: String
        }
        return Endpoint(.POST, "/booster", body: Body(
            task_id: taskId.uuidString.lowercased(),
            topic_id: topicId?.uuidString.lowercased(),
            reason: reason,
            question_preview: questionPreview
        ))
    }
    static func boosterRemove(_ taskId: UUID) -> Endpoint { Endpoint(.DELETE, "/booster/\(taskId.uuidString.lowercased())") }
    static func boosterUpdateReason(_ taskId: UUID, reason: String) -> Endpoint {
        struct Body: Encodable { let reason: String }
        return Endpoint(.PATCH, "/booster/\(taskId.uuidString.lowercased())/reason", body: Body(reason: reason))
    }

    // KB
    static let kbStats = Endpoint(.GET, "/kb/stats")
    static func kbAdd(taskId: UUID, topicId: UUID?) -> Endpoint {
        struct Body: Encodable { let task_id: String; let topic_id: String? }
        return Endpoint(.POST, "/kb", body: Body(task_id: taskId.uuidString.lowercased(), topic_id: topicId?.uuidString.lowercased()))
    }
    static let kbClear = Endpoint(.POST, "/kb/clear", body: EmptyBody())

    // Image proxy — goes through APIClient so auth header is included
    static func imageProxy(url: String) -> Endpoint {
        Endpoint(.GET, "/tasks/image-proxy", query: [.init(name: "url", value: url)])
    }
}

struct EmptyBody: Encodable {}
