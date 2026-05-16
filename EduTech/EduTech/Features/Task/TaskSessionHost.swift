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

    init(allIds: [UUID], topicId: UUID?, origin: TaskOrigin) {
        _allIds = State(initialValue: allIds)
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
            sessionHeader
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

                if showSwipeHint {
                    swipeHint
                }
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { router.pop() } label: {
                    Image(systemName: "xmark").foregroundStyle(Color.appFg)
                }
            }
            ToolbarItem(placement: .principal) {
                NavigationDots(
                    total: allIds.count,
                    currentIndex: currentPage,
                    solved: solvedSet,
                    failed: [],
                    ai: aiSet
                )
            }
        }
        .onChange(of: currentPage) { _, _ in dismissHint() }
    }

    // MARK: - Session header

    private var sessionHeader: some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                // Progress label
                Text("\(solvedCount)/\(threshold) разблокировано")
                    .font(.caption.bold())
                    .foregroundStyle(isUnlocked ? Color.appSuccess : Color.appMuted)

                Spacer()

                // "+" add more tasks
                if let topicId {
                    Button {
                        Task { await loadMoreTasks(topicId: topicId) }
                    } label: {
                        HStack(spacing: 4) {
                            if isLoadingMore {
                                ProgressView().scaleEffect(0.7)
                            } else {
                                Image(systemName: "plus")
                            }
                            Text("Ещё 5")
                        }
                        .font(.caption.bold())
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.appBorder.opacity(0.5))
                        .clipShape(Capsule())
                        .foregroundStyle(Color.appFg)
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoadingMore)
                }

                // "Завершить"
                Button {
                    Task { await finishSession() }
                } label: {
                    Text("Завершить")
                        .font(.caption.bold())
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(isUnlocked ? Color.appAccent : Color.appBorder.opacity(0.5))
                        .foregroundStyle(isUnlocked ? Color.appAccentFg : Color.appMuted)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            ProgressView(value: Double(min(solvedCount, threshold)), total: Double(threshold))
                .tint(isUnlocked ? Color.appSuccess : Color.appAccent)
                .padding(.horizontal, 20)
                .padding(.bottom, 6)
        }
        .background(Color.appBg)
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
        for taskId in allIds {
            if solvedTaskIds.contains(taskId) { continue }
            let reason = aiTaskIds.contains(taskId) ? "ai" : "skipped"
            try? await APIClient.shared.requestVoid(.boosterAdd(
                taskId: taskId, topicId: topicId, reason: reason, questionPreview: ""
            ))
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
