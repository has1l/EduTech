import Foundation
import SwiftUI

enum Phase: Equatable {
    case loading
    case question
    case submitting
    case correct
    case wrong(userAnswer: String)
    case dialogue(dialogueId: UUID)
    case giveup(correctAnswer: String, dialogueId: UUID)
}

@MainActor
@Observable
final class TaskVM {
    var task: EduTask?
    var phase: Phase = .loading
    var answer: String = ""
    var error: String?

    let taskId: UUID
    let allIds: [UUID]
    let total: Int
    let origin: TaskOrigin
    var queue: [UUID]

    var solvedPositions: Set<Int> = []
    var failedPositions: Set<Int> = []
    var aiPositions: Set<Int> = []

    var currentIndex: Int { (total - 1) - queue.count }
    var currentPosition: Int { currentIndex + 1 }

    init(taskId: UUID, queue: [UUID], total: Int, allIds: [UUID], origin: TaskOrigin) {
        self.taskId = taskId
        self.queue = queue
        self.total = total
        self.allIds = allIds
        self.origin = origin
    }

    func load() async {
        phase = .loading
        do {
            let t: EduTask = try await APIClient.shared.request(.task(taskId))
            self.task = t
            self.answer = ""
            phase = .question
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Не удалось загрузить задачу"
        }
    }

    func submit() async {
        guard case .question = phase, !answer.isEmpty, let task else { return }
        phase = .submitting
        do {
            let result: AnswerResult = try await APIClient.shared.request(.answer(task.id, answer: answer))
            if result.correct {
                solvedPositions.insert(currentPosition)
                phase = .correct
                Task.detached(priority: .background) {
                    try? await APIClient.shared.requestVoid(.kbAdd(taskId: task.id, topicId: task.topicId))
                }
                if let dlg = result.dialogueId { _ = dlg }
            } else {
                failedPositions.insert(currentPosition)
                phase = .wrong(userAnswer: answer)
                if let dlg = result.dialogueId {
                    // dialogue created — keep for "Help" press
                    pendingDialogueId = dlg
                }
            }
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
            phase = .question
        }
    }

    var pendingDialogueId: UUID?

    func askForHelp() {
        guard let dlg = pendingDialogueId else { return }
        aiPositions.insert(currentPosition)
        phase = .dialogue(dialogueId: dlg)
    }

    func giveUp() async {
        guard let dlg = pendingDialogueId else { return }
        do {
            let resp: GiveUpResponse = try await APIClient.shared.request(.dialogueGiveUp(dlg))
            aiPositions.insert(currentPosition)
            phase = .giveup(correctAnswer: resp.correctAnswer, dialogueId: dlg)
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }

    func resetAnswer() {
        if case .wrong = phase { phase = .question }
    }

    var hasNext: Bool { !queue.isEmpty }
}
