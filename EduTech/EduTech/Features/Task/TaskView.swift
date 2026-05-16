import SwiftUI

private enum TaskTab { case condition, tutor }

extension Phase {
    var dialogueId: UUID? {
        switch self {
        case .dialogue(let id): return id
        case .giveup(_, let id): return id
        default: return nil
        }
    }
    var hasDialogue: Bool { dialogueId != nil }
}

struct TaskView: View {
    @State var vm: TaskVM
    @State private var activeTab: TaskTab = .condition
    @Environment(Router.self) private var router
    @FocusState private var answerFocused: Bool

    // Embedded (TabView) mode callbacks — nil = standalone NavigationStack mode
    var pageIndex: Int? = nil
    var onNext: (() -> Void)? = nil
    var onSolved: (() -> Void)? = nil
    var onSolvedWithAI: (() -> Void)? = nil
    var onFinish: (() -> Void)? = nil

    var isEmbedded: Bool { onNext != nil }

    init(taskId: UUID, queue: [UUID], total: Int, allIds: [UUID], origin: TaskOrigin,
         pageIndex: Int? = nil, onNext: (() -> Void)? = nil,
         onSolved: (() -> Void)? = nil, onSolvedWithAI: (() -> Void)? = nil,
         onFinish: (() -> Void)? = nil) {
        _vm = State(initialValue: TaskVMCache.shared.getOrCreate(
            taskId, queue: queue, total: total, allIds: allIds, origin: origin))
        self.pageIndex = pageIndex
        self.onNext = onNext
        self.onSolved = onSolved
        self.onSolvedWithAI = onSolvedWithAI
        self.onFinish = onFinish
    }

    private var showTutor: Bool { activeTab == .tutor && vm.phase.hasDialogue }
    private var showCondition: Bool { !showTutor }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.appBg.ignoresSafeArea()
            VStack(spacing: 0) {
                if !isEmbedded { topProgressBar }
                if vm.phase.hasDialogue && isEmbedded {
                    compactTaskCard
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 4)
                }
                if vm.phase.hasDialogue {
                    tabSwitcher
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
                ZStack {
                    conditionScrollContent
                        .opacity(showCondition ? 1 : 0)
                        .allowsHitTesting(showCondition)
                    if vm.phase.hasDialogue {
                        tutorContent
                            .opacity(showTutor ? 1 : 0)
                            .allowsHitTesting(showTutor)
                    }
                }
            }
            if showCondition {
                conditionBottomBar
            }
        }
        .navigationBarBackButtonHidden(isEmbedded ? false : true)
        .toolbar {
            if !isEmbedded {
                ToolbarItem(placement: .topBarLeading) {
                    Button { router.pop() } label: {
                        Image(systemName: "xmark").foregroundStyle(Color.appFg)
                    }
                }
                ToolbarItem(placement: .principal) {
                    NavigationDots(
                        total: vm.total, currentIndex: vm.currentIndex,
                        solved: vm.solvedPositions, failed: vm.failedPositions, ai: vm.aiPositions
                    )
                }
            }
        }
        .task(id: vm.taskId) {
            vm.onSolvedCorrectly = onSolved
            vm.onSolvedWithAI = onSolvedWithAI
            await vm.load()
        }
        .onChange(of: vm.phase) { _, phase in
            if phase.hasDialogue {
                withAnimation(.spring(duration: 0.3)) { activeTab = .tutor }
            }
        }
    }

    // MARK: - Progress bar

    private var topProgressBar: some View {
        VStack(spacing: 6) {
            HStack {
                let s = vm.solvedPositions.count
                Text("\(s)/5 для разблокировки")
                    .font(.caption.bold())
                    .foregroundStyle(s >= 5 ? Color.appSuccess : Color.appMuted)
                Spacer()
                Text("Задача \(vm.currentPosition) из \(vm.total)")
                    .font(.caption).foregroundStyle(Color.appMuted)
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            ProgressView(value: Double(min(vm.solvedPositions.count, 5)), total: 5)
                .tint(vm.solvedPositions.count >= 5 ? Color.appSuccess : Color.appAccent)
                .padding(.horizontal, 20)
        }
    }

    // MARK: - Tab switcher

    private var tabSwitcher: some View {
        HStack(spacing: 4) {
            tabPill(label: "Условие", icon: "doc.text.fill", tab: .condition)
            tabPill(label: "Тьютор", icon: "sparkles", tab: .tutor)
        }
        .padding(4)
        .background(Color.appBorder.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    private func tabPill(label: String, icon: String, tab: TaskTab) -> some View {
        let active = activeTab == tab
        return Button {
            withAnimation(.spring(duration: 0.25)) { activeTab = tab }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.caption.bold())
                Text(label).font(.subheadline.bold())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            .background(active ? Color.appBg : Color.clear)
            .foregroundStyle(active ? Color.appFg : Color.appMuted)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .shadow(color: active ? Color.black.opacity(0.08) : .clear, radius: 4, y: 2)
        }
        .buttonStyle(.plain)
        .animation(.spring(duration: 0.25), value: active)
    }

    // MARK: - Condition tab

    private var conditionScrollContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                questionContent
                switch vm.phase {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                case .question, .submitting:
                    answerInputView
                    PrimaryButton(
                        title: "Проверить",
                        isLoading: vm.phase == .submitting,
                        disabled: vm.answer.isEmpty
                    ) {
                        answerFocused = false
                        Task { await vm.submit() }
                    }
                case .correct:
                    correctBanner
                case .wrong(let a):
                    wrongBanner(userAnswer: a)
                    answerInputView
                    HStack(spacing: 10) {
                        SecondaryButton(title: "Объяснить сразу") { Task { await vm.giveUp() } }
                        PrimaryButton(title: "Помоги разобрать") { vm.askForHelp() }
                    }
                case .dialogue, .giveup:
                    tutorCallout
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 140)
        }
    }

    private var tutorCallout: some View {
        Button {
            withAnimation(.spring(duration: 0.25)) { activeTab = .tutor }
        } label: {
            HStack(spacing: 12) {
                MascotView(kind: .thinking, size: 40).frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Тьютор ждёт твой ответ").font(.subheadline.bold())
                    Text("Перейди в чат").font(.caption).foregroundStyle(Color.appMuted)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Color.appMuted)
            }
            .padding(14)
            .background(Color.appAccent.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Tutor tab

    @ViewBuilder
    private var tutorContent: some View {
        if let dialogueId = vm.phase.dialogueId {
            VStack(spacing: 0) {
                if !isEmbedded {
                    compactTaskCard
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    Divider()
                }
                DialogueView(dialogueId: dialogueId, showHeader: false)
                    .id(dialogueId)
            }
        }
    }

    private var compactTaskCard: some View {
        Button {
            withAnimation(.spring(duration: 0.25)) { activeTab = .condition }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "doc.text.fill")
                    .font(.body)
                    .foregroundStyle(Color.appAccent)
                    .frame(width: 38, height: 38)
                    .background(Color.appAccent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Условие задачи")
                        .font(.caption.bold())
                        .foregroundStyle(Color.appMuted)
                    if let task = vm.task {
                        let raw = task.questionText.trimmingCharacters(in: .whitespacesAndNewlines)
                        let line = raw.components(separatedBy: .newlines).first(where: { !$0.isEmpty }) ?? raw
                        let preview = line.isEmpty ? "Смотри изображение" : String(line.prefix(55))
                        Text(preview + (line.count > 55 ? "…" : ""))
                            .font(.caption)
                            .foregroundStyle(Color.appFg)
                            .lineLimit(1)
                    }
                }
                Spacer()
                Image(systemName: "arrow.up.left.circle")
                    .font(.body)
                    .foregroundStyle(Color.appMuted)
            }
            .padding(12)
            .background(Color.appBg)
            .overlay {
                RoundedRectangle(cornerRadius: 14).strokeBorder(Color.appBorder, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Shared content

    @ViewBuilder
    private var questionContent: some View {
        if let task = vm.task {
            if let imageUrl = task.questionImageUrl { TaskImage(urlString: imageUrl) }
            if !shouldHideText(task: task) { MathText(text: task.questionText, fontSize: 20) }
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
                        Button { vm.answer = opt.id } label: {
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
            Image(systemName: "checkmark.circle.fill").font(.title).foregroundStyle(Color.appSuccess)
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
            MascotView(kind: .investigating, size: 44).frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text("Не то").font(.subheadline.bold()).foregroundStyle(Color.appDanger)
                Text("Твой ответ: \(userAnswer)").font(.caption).foregroundStyle(Color.appMuted)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.appDanger.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Bottom bar (condition tab)

    @ViewBuilder
    private var conditionBottomBar: some View {
        switch vm.phase {
        case .correct, .giveup, .dialogue:
            VStack {
                Spacer()
                PrimaryButton(title: vm.hasNext ? "Дальше →" : "Завершить") { goNext() }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background {
                        Rectangle().fill(.regularMaterial).ignoresSafeArea(edges: .bottom)
                    }
                    .overlay(alignment: .top) {
                        Rectangle().fill(Color.appBorder).frame(height: 0.5)
                    }
            }
        default:
            EmptyView()
        }
    }

    private func skipTask() {
        if isEmbedded {
            onNext?()
            return
        }
        guard vm.hasNext, let nextId = vm.queue.first else { return }
        Task {
            if let task = vm.task {
                try? await APIClient.shared.requestVoid(.boosterAdd(
                    taskId: task.id, topicId: task.topicId, reason: "skipped",
                    questionPreview: String(task.questionText.prefix(80))
                ))
            }
            let newQueue = Array(vm.queue.dropFirst())
            router.path.removeLast()
            router.path.append(Route.task(id: nextId, queue: newQueue, total: vm.total, all: vm.allIds, origin: vm.origin))
        }
    }

    private func goNext() {
        if isEmbedded {
            // Last task → finish session via host callback
            let myIndex = pageIndex ?? vm.currentIndex
            if myIndex + 1 >= vm.total {
                onFinish?()
            } else {
                onNext?()
            }
            return
        }
        if let nextId = vm.queue.first {
            let newQueue = Array(vm.queue.dropFirst())
            router.path.removeLast()
            router.path.append(Route.task(id: nextId, queue: newQueue, total: vm.total, all: vm.allIds, origin: vm.origin))
        } else {
            Task { await finishSession() }
        }
    }

    private func finishSession() async {
        for (idx, taskId) in vm.allIds.enumerated() {
            let position = idx + 1
            if vm.solvedPositions.contains(position) { continue }
            let reason = vm.aiPositions.contains(position) ? "ai" : "skipped"
            try? await APIClient.shared.requestVoid(.boosterAdd(
                taskId: taskId, topicId: vm.task?.topicId, reason: reason,
                questionPreview: vm.task?.questionText.prefix(80).description ?? ""
            ))
        }
        if vm.solvedPositions.count >= 5 {
            try? await APIClient.shared.requestVoid(.streakRecord)
        }
        router.popToRoot()
    }
}
