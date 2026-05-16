import Foundation

enum SSEEvent: Sendable {
    case delta(String)
    case theory(title: String?, sectionId: String?)
    case done
    case error(String)
}

struct SSEClient: Sendable {
    static let shared = SSEClient()

    nonisolated func stream(dialogueId: UUID) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let url = Config.apiBaseURL
                        .appendingPathComponent("dialogue/\(dialogueId.uuidString.lowercased())/stream")
                    var req = URLRequest(url: url)
                    req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    req.timeoutInterval = 300
                    if let token = await TokenManager.shared.accessToken {
                        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    }
                    let (bytes, response) = try await URLSession.shared.bytes(for: req)
                    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                        continuation.finish(throwing: APIError.invalidResponse)
                        return
                    }
                    var currentEvent: String? = nil
                    for try await line in bytes.lines {
                        if Task.isCancelled { break }
                        if line.isEmpty { currentEvent = nil; continue }
                        if line.hasPrefix("event:") {
                            currentEvent = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
                            continue
                        }
                        if line.hasPrefix("data:") {
                            let payload = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                            Self.emit(event: currentEvent, payload: payload, continuation: continuation)
                        }
                    }
                    continuation.yield(.done)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private static func emit(event: String?, payload: String, continuation: AsyncThrowingStream<SSEEvent, Error>.Continuation) {
        switch event {
        case "token":
            // payload is json.dumps(delta) — a JSON-encoded string e.g. "word"
            continuation.yield(.delta(jsonDecodeString(payload) ?? payload))

        case "meta":
            // {"theory_ref": {"title": "...", "section_id": "..."} | null, "hint_level": 1}
            if let data = payload.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let theoryData = json["theory_ref"] as? [String: Any] {
                continuation.yield(.theory(title: theoryData["title"] as? String, sectionId: theoryData["section_id"] as? String))
            }
            // done is sent separately by backend, but yield here just in case

        case "done":
            continuation.yield(.done)

        case "error":
            if let data = payload.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let msg = json["message"] as? String {
                continuation.yield(.error(msg))
            } else {
                continuation.yield(.error(payload))
            }

        default:
            if payload == "[DONE]" {
                continuation.yield(.done)
            }
        }
    }

    private static func jsonDecodeString(_ s: String) -> String? {
        guard let data = s.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed) as? String
    }
}
