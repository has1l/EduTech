import SwiftUI

/// Hosts a paging session of tasks. Uses TabView for native horizontal swipe
/// that works correctly alongside vertical ScrollView inside each page.
struct TaskSessionHost: View {
    let allIds: [UUID]
    let origin: TaskOrigin

    @State private var currentPage = 0
    @State private var solvedTaskIds: Set<UUID> = []
    @State private var aiTaskIds: Set<UUID> = []

    // Convert task IDs to 1-based position sets for NavigationDots
    private var solvedSet: Set<Int> {
        Set(allIds.enumerated().compactMap { solvedTaskIds.contains($0.element) ? $0.offset + 1 : nil })
    }
    private var aiSet: Set<Int> {
        Set(allIds.enumerated().compactMap { aiTaskIds.contains($0.element) ? $0.offset + 1 : nil })
    }
    @State private var showSwipeHint: Bool = !AppDefaults.didShowSwipeHint
    @Environment(Router.self) private var router

    var body: some View {
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
                            withAnimation { currentPage = min(index + 1, allIds.count - 1) }
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
        .onChange(of: currentPage) { _, _ in
            dismissHint()
        }
    }

    private var swipeHint: some View {
        VStack {
            Spacer()
            HStack(spacing: 10) {
                Image(systemName: "arrow.left").font(.callout)
                Text("свайпайте для смены задания")
                    .font(.subheadline)
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

    private func finishSession() async {
        // Add unsolved tasks to booster
        for taskId in allIds {
            if solvedTaskIds.contains(taskId) { continue }
            let reason = aiTaskIds.contains(taskId) ? "ai" : "skipped"
            try? await APIClient.shared.requestVoid(.boosterAdd(
                taskId: taskId, topicId: nil, reason: reason, questionPreview: ""
            ))
        }
        // Record streak when threshold met
        if solvedTaskIds.count >= 5 {
            try? await APIClient.shared.requestVoid(.streakRecord)
        }
        router.popToRoot()
    }
}
