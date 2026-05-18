import SwiftUI

// MARK: - ViewModel

@Observable
@MainActor
private final class DiagnosticVM {
    enum Phase { case intro, loading, quiz, submitting }

    var phase: Phase = .intro
    var session: DiagnosticSession?
    var currentPage: Int = 0
    var answers: [UUID: String] = [:]
    var loadError: String?

    var tasks: [EduTask] { session?.tasks ?? [] }
    var answeredCount: Int { answers.values.filter { !$0.isEmpty }.count }

    func start() async {
        loadError = nil
        phase = .loading
        do {
            let sess: DiagnosticSession = try await APIClient.shared.request(.diagnosticStart)
            session = sess
            phase = .quiz
        } catch {
            loadError = "Не удалось загрузить задания. Попробуй ещё раз."
            phase = .intro
        }
    }

    func submit() async -> DiagnosticResult? {
        guard let session else { return nil }
        phase = .submitting
        do {
            let result: DiagnosticResult = try await APIClient.shared.request(
                .diagnosticSubmit(
                    sessionId: session.sessionId,
                    answers: tasks.map { (taskId: $0.id, answer: answers[$0.id] ?? "") }
                )
            )
            return result
        } catch {
            phase = .quiz
            return nil
        }
    }
}

// MARK: - DiagnosticView

struct DiagnosticView: View {
    @Environment(AppState.self) private var appState
    @Environment(Router.self) private var router

    @State private var vm = DiagnosticVM()
    @State private var showSwipeHint = !AppDefaults.didShowDiagnosticSwipeHint

    var body: some View {
        Group {
            switch vm.phase {
            case .intro, .loading:
                introView
                    .navigationTitle("Диагностика")
                    .navigationBarTitleDisplayMode(.inline)
            case .quiz, .submitting:
                quizSession
            }
        }
    }

    // MARK: - Intro

    private var introView: some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer().frame(height: 40)

                RoundedRectangle(cornerRadius: 24)
                    .fill(Color.appAccent.opacity(0.15))
                    .frame(width: 80, height: 80)
                    .overlay {
                        Image(systemName: "list.clipboard.fill")
                            .font(.system(size: 34))
                            .foregroundStyle(Color.appAccent)
                    }

                Spacer().frame(height: 20)

                Text("Пробный тест")
                    .font(.title.bold())
                    .foregroundStyle(Color.appFg)

                Spacer().frame(height: 8)

                Text("Пройди короткую диагностику — определим твой уровень и составим персональный план.")
                    .font(.subheadline)
                    .foregroundStyle(Color.appMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)

                Spacer().frame(height: 32)

                VStack(spacing: 12) {
                    infoRow(icon: "list.clipboard.fill", title: "12 заданий",     sub: "Задания 1–12 из ЕГЭ · Математика")
                    infoRow(icon: "clock.fill",          title: "15–20 минут",    sub: "Можно пропустить трудные задания")
                    infoRow(icon: "chart.bar.fill",      title: "Персональный план", sub: "AI составит маршрут по слабым темам")
                }
                .padding(.horizontal, 20)

                if let err = vm.loadError {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(Color.appDanger)
                        .multilineTextAlignment(.center)
                        .padding(.top, 16)
                        .padding(.horizontal, 20)
                }

                Spacer().frame(height: 32)

                PrimaryButton(
                    title: vm.phase == .loading ? "Загружаем задания…" : "Начать диагностику",
                    isLoading: vm.phase == .loading
                ) {
                    Task { await vm.start() }
                }
                .padding(.horizontal, 20)

                Button {
                    router.popToRoot()
                } label: {
                    Text("Пропустить")
                        .font(.subheadline)
                        .foregroundStyle(Color.appMuted)
                        .padding(.top, 14)
                }
                .disabled(vm.phase == .loading)

                Spacer().frame(height: 40)
            }
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Color.appBg)
    }

    private func infoRow(icon: String, title: String, sub: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(Color.appAccent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.bold()).foregroundStyle(Color.appFg)
                Text(sub).font(.caption).foregroundStyle(Color.appMuted)
            }
            Spacer()
        }
        .padding(16)
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Quiz session (TabView swipe)

    private var pageBinding: Binding<Int> {
        Binding(get: { vm.currentPage }, set: { vm.currentPage = $0 })
    }

    private var quizSession: some View {
        VStack(spacing: 0) {
            quizTopBar
            quizProgressBar
            Divider()
            ZStack {
                TabView(selection: pageBinding) {
                    ForEach(Array(vm.tasks.enumerated()), id: \.offset) { i, task in
                        DiagnosticTaskPage(
                            taskNumber: i + 1,
                            total: vm.tasks.count,
                            task: task,
                            answer: Binding(
                                get: { vm.answers[task.id] ?? "" },
                                set: { vm.answers[task.id] = $0 }
                            )
                        )
                        .tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                if showSwipeHint { swipeHintOverlay }
            }
        }
        .background(Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .onChange(of: vm.currentPage) { _, _ in dismissHint() }
    }

    private var quizTopBar: some View {
        HStack(spacing: 0) {
            Button { router.pop() } label: {
                Image(systemName: "xmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.appFg)
                    .frame(width: 36, height: 36)
                    .background(Color.appBorder.opacity(0.3))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)

            Spacer()

            DiagnosticDots(
                total: vm.tasks.count,
                currentIndex: vm.currentPage,
                answered: Set(vm.tasks.enumerated().compactMap {
                    !(vm.answers[$0.element.id] ?? "").isEmpty ? $0.offset : nil
                })
            )

            Spacer()

            Button {
                Task { await handleSubmit() }
            } label: {
                Group {
                    if vm.phase == .submitting {
                        ProgressView().scaleEffect(0.75).tint(Color.appAccentFg)
                    } else {
                        Text("Отправить").font(.subheadline.bold())
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(vm.answeredCount > 0 ? Color.appAccent : Color.appBorder.opacity(0.35))
                .foregroundStyle(vm.answeredCount > 0 ? Color.appAccentFg : Color.appMuted)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(vm.phase == .submitting)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 8)
    }

    private var quizProgressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(Color.appBorder.opacity(0.3)).frame(height: 3)
                let pct = vm.tasks.isEmpty ? 0.0 : Double(vm.answeredCount) / Double(vm.tasks.count)
                Rectangle()
                    .fill(Color.appAccent)
                    .frame(width: geo.size.width * pct, height: 3)
                    .animation(.easeInOut(duration: 0.25), value: vm.answeredCount)
            }
        }
        .frame(height: 3)
        .padding(.horizontal, 20)
        .padding(.bottom, 6)
    }

    // MARK: - Swipe hint

    private var swipeHintOverlay: some View {
        VStack {
            Spacer()
            HStack(spacing: 10) {
                Image(systemName: "arrow.left").font(.callout)
                Text("свайпайте для смены задания").font(.subheadline)
                Image(systemName: "arrow.right").font(.callout)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 22)
            .padding(.vertical, 13)
            .background(.black.opacity(0.65))
            .clipShape(Capsule())
            .padding(.bottom, 160)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture { dismissHint() }
        .transition(.opacity)
        .animation(.smooth, value: showSwipeHint)
    }

    private func dismissHint() {
        guard showSwipeHint else { return }
        withAnimation(.smooth) { showSwipeHint = false }
        AppDefaults.didShowDiagnosticSwipeHint = true
    }

    // MARK: - Submit

    private func handleSubmit() async {
        guard let result = await vm.submit() else { return }
        appState.lastDiagnosticResult = result

        let pct = result.total > 0 ? Double(result.correct) / Double(result.total) : 0
        let grade = appState.currentUser?.grade ?? 11
        let isOge = grade <= 9
        let score: Int = isOge
            ? (result.correct >= 9 ? 5 : result.correct >= 4 ? 4 : 3)
            : (pct >= 0.75 ? 85 : pct >= 0.55 ? 70 : pct >= 0.30 ? 50 : 30)
        do {
            let updated: User = try await APIClient.shared.request(
                Endpoint.updateMe(
                    grade: nil,
                    currentScore: isOge ? nil : score,
                    ogeCurrentScore: isOge ? score : nil,
                    targetScore: nil,
                    examDate: nil,
                    name: nil
                )
            )
            appState.currentUser = updated
        } catch {}

        try? await appState.fetchMe()
        router.replace(with: .diagnosticResult)
    }
}

// MARK: - DiagnosticTaskPage

private struct DiagnosticTaskPage: View {
    let taskNumber: Int
    let total: Int
    let task: EduTask
    @Binding var answer: String

    @FocusState private var focused: Bool

    private var isEllipsis: Bool {
        task.questionText.hasSuffix("...") || task.questionText.hasSuffix("…")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Task number label
                HStack {
                    Text("Задание \(taskNumber) из \(total)")
                        .font(.caption.bold())
                        .foregroundStyle(Color.appMuted)
                    Spacer()
                }

                // Task card
                VStack(alignment: .leading, spacing: 12) {
                    if let imgUrl = task.questionImageUrl {
                        TaskImage(urlString: imgUrl, maxHeight: 300)
                    }
                    if !(isEllipsis && task.questionImageUrl != nil) {
                        MathText(text: task.questionText, fontSize: 16)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.appBg)
                .overlay { RoundedRectangle(cornerRadius: 18).strokeBorder(Color.appBorder, lineWidth: 1) }
                .clipShape(RoundedRectangle(cornerRadius: 18))

                // Answer field
                VStack(alignment: .leading, spacing: 8) {
                    Text("Ваш ответ")
                        .font(.caption.bold())
                        .foregroundStyle(Color.appMuted)

                    TextField("Введите ответ…", text: $answer)
                        .keyboardType(.numbersAndPunctuation)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focused)
                        .padding(14)
                        .background(Color.appBg)
                        .overlay {
                            RoundedRectangle(cornerRadius: 14)
                                .strokeBorder(focused ? Color.appAccent : Color.appBorder, lineWidth: 1.5)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 14))

                    if !answer.isEmpty {
                        Label("Ответ сохранён", systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(Color.appSuccess)
                    }
                }

                Spacer().frame(height: 40)
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color.appBg)
    }
}

// MARK: - DiagnosticDots

private struct DiagnosticDots: View {
    let total: Int
    let currentIndex: Int
    let answered: Set<Int>   // offsets (0-based) of answered tasks

    private let maxVisible = 7

    private var windowStart: Int {
        guard total > maxVisible else { return 0 }
        let half = maxVisible / 2
        return min(max(0, currentIndex - half), total - maxVisible)
    }

    private var visibleIndices: [Int] {
        let start = windowStart
        return Array(start..<min(start + maxVisible, total))
    }

    var body: some View {
        HStack(spacing: 6) {
            ForEach(visibleIndices, id: \.self) { idx in
                let isCurrent  = idx == currentIndex
                let isAnswered = answered.contains(idx)
                let isEdge = total > maxVisible &&
                    (idx == visibleIndices.first || idx == visibleIndices.last)

                let color: Color = isCurrent  ? Color.appFg :
                                   isAnswered ? Color.appSuccess :
                                                Color.appBorder

                Circle()
                    .fill(color)
                    .frame(width: isCurrent ? 10 : 8, height: isCurrent ? 10 : 8)
                    .opacity(isEdge ? 0.35 : 1)
                    .animation(.smooth, value: color)
                    .transition(.scale(scale: 0.4).combined(with: .opacity))
            }
        }
        .animation(.smooth, value: currentIndex)
    }
}

// MARK: - DiagnosticResultView

struct DiagnosticResultView: View {
    @Environment(AppState.self) private var appState
    @Environment(Router.self) private var router

    private var result: DiagnosticResult? { appState.lastDiagnosticResult }

    var body: some View {
        Group {
            if let result {
                resultContent(result)
            } else {
                noResultView
            }
        }
        .background(Color.appBg)
        .navigationTitle("Результат")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
    }

    private var noResultView: some View {
        VStack(spacing: 14) {
            Text("Результаты не найдены")
                .font(.headline)
                .foregroundStyle(Color.appMuted)
            Button("Пройти диагностику") { router.pop() }
                .foregroundStyle(Color.appAccent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func resultContent(_ result: DiagnosticResult) -> some View {
        let pct = result.total > 0 ? Double(result.correct) / Double(result.total) : 0
        let verdict = getVerdict(pct: pct)
        let weakSections   = result.sections.filter { !$0.isCorrect }
        let strongSections = result.sections.filter {  $0.isCorrect }

        ScrollView {
            VStack(spacing: 20) {
                // Score card
                VStack(spacing: 16) {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(Color.appAccent)

                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text("\(result.correct)")
                            .font(.system(size: 60, weight: .black, design: .rounded))
                            .foregroundStyle(scoreColor(pct: pct))
                        Text("/\(result.total)")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(Color.appMuted)
                    }
                    Text("правильных ответов")
                        .font(.subheadline)
                        .foregroundStyle(Color.appMuted)

                    Divider()

                    VStack(spacing: 4) {
                        Text(verdict.title).font(.headline).foregroundStyle(Color.appFg)
                        Text(verdict.sub)
                            .font(.caption)
                            .foregroundStyle(Color.appMuted)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity)
                .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(Color.appBorder, lineWidth: 1) }
                .clipShape(RoundedRectangle(cornerRadius: 20))

                // Per-task results
                VStack(alignment: .leading, spacing: 0) {
                    Text("РЕЗУЛЬТАТЫ ПО ЗАДАНИЯМ")
                        .font(.caption2.bold())
                        .foregroundStyle(Color.appMuted)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)

                    ForEach(result.sections) { section in
                        SectionResultRow(section: section)
                    }
                }
                .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(Color.appBorder, lineWidth: 1) }
                .clipShape(RoundedRectangle(cornerRadius: 20))

                if !weakSections.isEmpty {
                    summaryBlock(
                        label: "Слабые места (\(weakSections.count))",
                        color: Color.appDanger,
                        sections: weakSections
                    )
                }

                if !strongSections.isEmpty {
                    summaryBlock(
                        label: "Сильные стороны (\(strongSections.count))",
                        color: Color.appSuccess,
                        sections: strongSections
                    )
                }

                PrimaryButton(title: "Начать обучение по плану") {
                    router.popToRoot()
                }

                Button {
                    appState.lastDiagnosticResult = nil
                    router.replace(with: .diagnostic)
                } label: {
                    Text("Пройти заново")
                        .font(.subheadline)
                        .foregroundStyle(Color.appMuted)
                }

                Spacer().frame(height: 8)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
        }
    }

    private func summaryBlock(label: String, color: Color, sections: [DiagnosticSectionResult]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(.caption.bold()).foregroundStyle(color)
            ForEach(sections) { s in
                Text("· Задание \(s.taskNumber) — \(s.title)")
                    .font(.subheadline)
                    .foregroundStyle(Color.appMuted)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.05))
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(color.opacity(0.2), lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func scoreColor(pct: Double) -> Color {
        pct >= 0.75 ? Color.appSuccess : pct >= 0.50 ? Color.appAccent : Color.appDanger
    }

    private func getVerdict(pct: Double) -> (title: String, sub: String) {
        switch pct {
        case 0.8...: return ("Отличный результат!", "Ты хорошо знаешь базу — закрепляем и идём вперёд")
        case 0.6...: return ("Хорошая база", "Есть пробелы — AI-разбор поможет их закрыть")
        case 0.4...: return ("Есть над чем работать", "Много слабых тем — но именно это и покажет план")
        default:     return ("Начинаем с основ", "Не переживай — персональный план всё разложит по полочкам")
        }
    }
}

// MARK: - SectionResultRow

private struct SectionResultRow: View {
    let section: DiagnosticSectionResult

    private var difficultyColor: Color {
        switch section.difficulty {
        case 1: Color.appSuccess
        case 3: Color.appDanger
        default: Color.appAccent
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(difficultyColor.opacity(0.15))
                .frame(width: 32, height: 32)
                .overlay {
                    Text("\(section.taskNumber)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(difficultyColor)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(section.title)
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.appFg)
                    .lineLimit(1)
                Text(section.topicTitle)
                    .font(.caption)
                    .foregroundStyle(Color.appMuted)
                    .lineLimit(1)
            }

            Spacer()

            if section.isCorrect {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.appSuccess)
            } else {
                HStack(spacing: 6) {
                    Text("→ \(section.correctAnswer)")
                        .font(.caption)
                        .foregroundStyle(Color.appMuted)
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.appDanger)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) {
            Divider().padding(.leading, 56)
        }
    }
}
