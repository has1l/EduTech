import SwiftUI

struct TaskView: View {
    @State var vm: TaskVM
    @Environment(Router.self) private var router
    @FocusState private var answerFocused: Bool

    init(taskId: UUID, queue: [UUID], total: Int, allIds: [UUID], origin: TaskOrigin) {
        _vm = State(initialValue: TaskVM(taskId: taskId, queue: queue, total: total, allIds: allIds, origin: origin))
    }

    var body: some View {
        ZStack {
            Color.appBg.ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        questionContent
                        switch vm.phase {
                        case .loading:
                            ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                        case .question, .submitting:
                            answerInputView
                        case .correct:
                            correctBanner
                        case .wrong(let userAnswer):
                            wrongBanner(userAnswer: userAnswer)
                            answerInputView
                        case .dialogue(let id):
                            DialogueView(dialogueId: id)
                                .frame(minHeight: 400)
                                .id(id)
                        case .giveup(let correct, let id):
                            giveUpBanner(correct: correct)
                            DialogueView(dialogueId: id)
                                .frame(minHeight: 400)
                                .id(id)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 140)
                }
            }
            bottomBar
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    router.pop()
                } label: {
                    Image(systemName: "xmark").foregroundStyle(Color.appFg)
                }
            }
            ToolbarItem(placement: .principal) {
                NavigationDots(
                    total: vm.total,
                    currentIndex: vm.currentIndex,
                    solved: vm.solvedPositions,
                    failed: vm.failedPositions,
                    ai: vm.aiPositions
                )
            }
        }
        .task(id: vm.taskId) { await vm.load() }
    }

    private var topBar: some View {
        VStack(spacing: 6) {
            HStack {
                let solved = vm.solvedPositions.count
                Text("\(solved)/5 для разблокировки").font(.caption.bold()).foregroundStyle(solved >= 5 ? Color.appSuccess : Color.appMuted)
                Spacer()
                Text("Задача \(vm.currentPosition) из \(vm.total)").font(.caption).foregroundStyle(Color.appMuted)
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            ProgressView(value: Double(min(vm.solvedPositions.count, 5)), total: 5)
                .tint(vm.solvedPositions.count >= 5 ? Color.appSuccess : Color.appAccent)
                .padding(.horizontal, 20)
        }
    }

    @ViewBuilder
    private var questionContent: some View {
        if let task = vm.task {
            if let imageUrl = task.questionImageUrl {
                TaskImage(urlString: imageUrl)
            }
            if !shouldHideText(task: task) {
                Text(task.questionText)
                    .font(.system(.title3, design: .serif))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func shouldHideText(task: EduTask) -> Bool {
        guard task.questionImageUrl != nil else { return false }
        let t = task.questionText.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.hasSuffix("...") || t.hasSuffix("…") || t.isEmpty
    }

    @ViewBuilder
    private var answerInputView: some View {
        if let task = vm.task {
            if task.type == "multiple_choice", let options = task.options {
                VStack(spacing: 10) {
                    ForEach(options) { opt in
                        let selected = vm.answer == opt.id
                        Button {
                            vm.answer = opt.id
                        } label: {
                            HStack(alignment: .top) {
                                Text(opt.id).font(.headline)
                                    .frame(width: 26, height: 26)
                                    .background(selected ? Color.appFg : Color.appBorder.opacity(0.4), in: Circle())
                                    .foregroundStyle(selected ? Color.appBg : Color.appFg)
                                Text(opt.text).foregroundStyle(Color.appFg)
                                Spacer()
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(selected ? Color.appAccent.opacity(0.18) : Color.clear)
                            .overlay {
                                RoundedRectangle(cornerRadius: 16)
                                    .strokeBorder(selected ? Color.appAccent : Color.appBorder, lineWidth: 1.5)
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                TextField("Твой ответ", text: $vm.answer)
                    .keyboardType(.numbersAndPunctuation)
                    .padding(14)
                    .background(Color.appBg)
                    .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Color.appBorder, lineWidth: 1.5) }
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .focused($answerFocused)
                    .onChange(of: vm.answer) { _, _ in vm.resetAnswer() }
            }
        }
    }

    private var correctBanner: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.title)
                .foregroundStyle(Color.appSuccess)
            VStack(alignment: .leading) {
                Text("Верно!").font(.headline)
                Text("Задача попадёт в базу знаний").font(.caption).foregroundStyle(Color.appMuted)
            }
            Spacer()
        }
        .padding(16)
        .background(Color.appSuccess.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func wrongBanner(userAnswer: String) -> some View {
        HStack(spacing: 12) {
            MascotView(kind: .investigating, size: 44)
                .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text("Не то").font(.subheadline.bold()).foregroundStyle(Color.appDanger)
                Text("Твой ответ: \(userAnswer)").font(.caption).foregroundStyle(Color.appMuted)
            }
            Spacer()
            Button {
                vm.askForHelp()
            } label: {
                Text("Помоги")
                    .font(.subheadline.bold())
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Color.appFg)
                    .foregroundStyle(Color.appBg)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(Color.appDanger.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func giveUpBanner(correct: String) -> some View {
        HStack {
            Image(systemName: "lightbulb.fill").foregroundStyle(Color.appAccent)
            VStack(alignment: .leading) {
                Text("Правильный ответ: \(correct)").font(.subheadline.bold())
                Text("Разбираю задачу — читай ниже").font(.caption).foregroundStyle(Color.appMuted)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.appAccent.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private var bottomBar: some View {
        VStack {
            Spacer()
            HStack(spacing: 10) {
                switch vm.phase {
                case .question, .submitting:
                    PrimaryButton(
                        title: "Проверить",
                        isLoading: vm.phase == .submitting,
                        disabled: vm.answer.isEmpty
                    ) {
                        answerFocused = false
                        Task { await vm.submit() }
                    }
                case .wrong:
                    SecondaryButton(title: "Объяснить сразу") {
                        Task { await vm.giveUp() }
                    }
                    PrimaryButton(title: "Помоги разобрать") {
                        vm.askForHelp()
                    }
                case .correct, .giveup, .dialogue:
                    PrimaryButton(title: vm.hasNext ? "Дальше" : "Завершить") {
                        goNext()
                    }
                case .loading:
                    EmptyView()
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background {
                Rectangle()
                    .fill(.regularMaterial)
                    .ignoresSafeArea(edges: .bottom)
            }
            .overlay(alignment: .top) {
                Rectangle().fill(Color.appBorder).frame(height: 0.5)
            }
        }
    }

    private func goNext() {
        if let nextId = vm.queue.first {
            let newQueue = Array(vm.queue.dropFirst())
            router.path.removeLast()
            router.path.append(Route.task(id: nextId, queue: newQueue, total: vm.total, all: vm.allIds, origin: vm.origin))
        } else {
            Task { await finishSession() }
        }
    }

    private func finishSession() async {
        // Add unsolved tasks to booster
        for (idx, taskId) in vm.allIds.enumerated() {
            let position = idx + 1
            if vm.solvedPositions.contains(position) { continue }
            let reason = vm.aiPositions.contains(position) ? "ai" : "skipped"
            try? await APIClient.shared.requestVoid(.boosterAdd(
                taskId: taskId, topicId: vm.task?.topicId, reason: reason, questionPreview: vm.task?.questionText.prefix(80).description ?? ""
            ))
        }
        // Record streak if subtype unlocked
        if vm.solvedPositions.count >= 5 {
            try? await APIClient.shared.requestVoid(.streakRecord)
        }
        router.popToRoot()
    }
}
