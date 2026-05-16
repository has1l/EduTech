import SwiftUI

struct TaskSessionHost: View {
    let topicId: UUID?
    let origin: TaskOrigin

    @State private var allIds: [UUID]
    @State private var currentPage = 0
    @State private var solvedTaskIds: Set<UUID> = []
    @State private var aiTaskIds: Set<UUID> = []
    @State private var isLoadingMore = false
    @State private var showSwipeHint: Bool = !AppDefaults.didShowSwipeHint
    @Environment(Router.self) private var router

    init(allIds: [UUID], topicId: UUID?, origin: TaskOrigin, initialPage: Int = 0) {
        _allIds = State(initialValue: allIds)
        _currentPage = State(initialValue: min(initialPage, max(0, allIds.count - 1)))
        self.topicId = topicId
        self.origin = origin
    }

    private var solvedCount: Int { solvedTaskIds.count }
    private var threshold: Int { 5 }
    private var isUnlocked: Bool { solvedCount >= threshold }

    private var solvedSet: Set<Int> {
        Set(allIds.enumerated().compactMap { solvedTaskIds.contains($0.element) ? $0.offset + 1 : nil })
    }
    private var aiSet: Set<Int> {
        Set(allIds.enumerated().compactMap { aiTaskIds.contains($0.element) ? $0.offset + 1 : nil })
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ProgressView(value: Double(min(solvedCount, threshold)), total: Double(threshold))
                .tint(isUnlocked ? Color.appSuccess : Color.appAccent)
                .padding(.horizontal, 20)
                .padding(.bottom, 6)
            Divider()
            ZStack {
                TabView(selection: $currentPage) {
                    ForEach(Array(allIds.enumerated()), id: \.offset) { index, taskId in
                        TaskView(
                            taskId: taskId,
                            queue: [],
                            total: allIds.count,
                            allIds: allIds,
                            origin: origin,
                            pageIndex: index,
                            onNext: {
                                let next = index + 1
                                if next < allIds.count {
                                    withAnimation { currentPage = next }
                                } else {
                                    Task { await finishSession() }
                                }
                            },
                            onSolved: { solvedTaskIds.insert(taskId) },
                            onSolvedWithAI: { aiTaskIds.insert(taskId) },
                            onFinish: { Task { await finishSession() } }
                        )
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                if showSwipeHint { swipeHint }
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .onChange(of: currentPage) { _, _ in dismissHint() }
        .onDisappear {
            TaskVMCache.shared.clear()
            DialogueVMCache.shared.clear()
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: 0) {
            // Close button
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

            // Sliding dots + optional "+" button
            HStack(spacing: 10) {
                SessionDots(
                    total: allIds.count,
                    currentIndex: currentPage,
                    solved: solvedSet,
                    ai: aiSet
                )
                if topicId != nil && origin != .booster {
                    Button {
                        Task { await loadMoreTasks(topicId: topicId!) }
                    } label: {
                        Group {
                            if isLoadingMore {
                                ProgressView().scaleEffect(0.65)
                            } else {
                                Image(systemName: "plus")
                                    .font(.caption.bold())
                            }
                        }
                        .foregroundStyle(Color.appMuted)
                        .frame(width: 20, height: 20)
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoadingMore)
                }
            }

            Spacer()

            // Finish button
            Button {
                Task { await finishSession() }
            } label: {
                Text("Завершить")
                    .font(.subheadline.bold())
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(isUnlocked ? Color.appAccent : Color.appBorder.opacity(0.35))
                    .foregroundStyle(isUnlocked ? Color.appAccentFg : Color.appMuted)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 8)
    }

    // MARK: - Load more

    private func loadMoreTasks(topicId: UUID) async {
        guard !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        let seenIds = Set(allIds)
        do {
            let session: SubtopicSession = try await APIClient.shared.request(
                .subtopicSession(topicId: topicId, count: 10)
            )
            let newIds = session.tasks.map(\.id).filter { !seenIds.contains($0) }.prefix(5)
            allIds.append(contentsOf: newIds)
        } catch {}
    }

    // MARK: - Finish

    private func finishSession() async {
        if origin != .booster {
            for taskId in allIds {
                if solvedTaskIds.contains(taskId) { continue }
                let reason = aiTaskIds.contains(taskId) ? "ai" : "skipped"
                try? await APIClient.shared.requestVoid(.boosterAdd(
                    taskId: taskId, topicId: topicId, reason: reason, questionPreview: ""
                ))
            }
        }
        if isUnlocked {
            try? await APIClient.shared.requestVoid(.streakRecord)
        }
        router.popToRoot()
    }

    // MARK: - Swipe hint

    private var swipeHint: some View {
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
        AppDefaults.didShowSwipeHint = true
    }
}

// Sliding-window dots: always shows ≤5 dots, extras fade in/out at edges
private struct SessionDots: View {
    let total: Int
    let currentIndex: Int
    let solved: Set<Int>
    let ai: Set<Int>

    private let maxVisible = 5

    private var windowStart: Int {
        guard total > maxVisible else { return 0 }
        let half = maxVisible / 2
        return min(max(0, currentIndex - half), total - maxVisible)
    }

    private var visibleIndices: [Int] {
        let start = windowStart
        let end = min(start + maxVisible, total)
        return Array(start..<end)
    }

    var body: some View {
        HStack(spacing: 6) {
            ForEach(visibleIndices, id: \.self) { idx in
                let position = idx + 1
                let isCurrent = idx == currentIndex
                let isEdge = total > maxVisible &&
                    (idx == visibleIndices.first || idx == visibleIndices.last)

                let color: Color = {
                    if isCurrent { return Color.appFg }
                    if solved.contains(position) { return Color.appSuccess }
                    if ai.contains(position) { return Color.appAccent }
                    return Color.appBorder
                }()

                Circle()
                    .fill(color)
                    .frame(width: isCurrent ? 10 : 8, height: isCurrent ? 10 : 8)
                    .opacity(isEdge ? 0.35 : 1.0)
                    .animation(.smooth, value: color)
                    .transition(.scale(scale: 0.4).combined(with: .opacity))
            }
        }
        .animation(.smooth, value: currentIndex)
    }
}
