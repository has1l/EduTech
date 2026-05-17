import SwiftUI

private let zigzagOffsets: [CGFloat] = [56, 16, -56, -16, 56, 16, -56, -16]

struct SessionPathView: View {
    @Environment(Router.self) private var router
    @State private var sections: [TaskSection] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var loadingNodeId: UUID?
    @State private var activeTab = 0

    var body: some View {
        VStack(spacing: 0) {
            tabSwitcher
                .padding(.horizontal, 20)
                .padding(.top, 10)
                .padding(.bottom, 8)
            Divider()
            Group {
                if activeTab == 0 {
                    pathTab
                } else {
                    _EmbeddedPlanContent()
                }
            }
        }
        .background(Color.appBg)
        .navigationTitle("Путь")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    // MARK: - Tab switcher

    private var tabSwitcher: some View {
        HStack(spacing: 4) {
            tabPill("bolt.fill", "Путь", 0)
            tabPill("brain.head.profile", "Мой план", 1)
        }
        .padding(4)
        .background(Color.appBorder.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func tabPill(_ icon: String, _ label: String, _ idx: Int) -> some View {
        let active = activeTab == idx
        return Button {
            withAnimation(.spring(duration: 0.25)) { activeTab = idx }
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

    // MARK: - Path tab

    private var pathTab: some View {
        ScrollView {
            VStack(spacing: 40) {
                statsBar
                if isLoading {
                    VStack(spacing: 40) {
                        ForEach(0..<3, id: \.self) { _ in skeletonSection }
                    }
                } else if let e = error {
                    Text(e).foregroundStyle(Color.appDanger).font(.subheadline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ForEach(sections) { section in sectionBlock(section) }
                    if !sections.isEmpty { finishBadge }
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 20)
            .padding(.bottom, 60)
        }
        .refreshable { await load() }
    }

    // MARK: - Stats bar

    private var statsBar: some View {
        let allNodes = sections.flatMap(\.nodes)
        let done = allNodes.filter { $0.state == .completed }.count
        return HStack(spacing: 4) {
            if !isLoading && !allNodes.isEmpty {
                Text("\(done)").font(.subheadline.bold())
                Text("/ \(allNodes.count) подтем").font(.subheadline).foregroundStyle(Color.appMuted)
                if done == allNodes.count {
                    Text("· Все пройдены ✓").font(.subheadline.bold()).foregroundStyle(Color.appSuccess)
                }
            }
            Spacer()
        }
    }

    // MARK: - Section

    @ViewBuilder
    private func sectionBlock(_ section: TaskSection) -> some View {
        VStack(spacing: 0) {
            sectionHeader(section)
            VStack(spacing: 28) {
                ForEach(Array(section.nodes.enumerated()), id: \.offset) { i, node in
                    PathNodeView(
                        node: node,
                        xOffset: zigzagOffsets[i % zigzagOffsets.count],
                        isLoadingTap: loadingNodeId == node.topicId,
                        onTap: { Task { await startSubtopic(node) } }
                    )
                }
            }
            .padding(.top, 24)
        }
    }

    private func sectionHeader(_ section: TaskSection) -> some View {
        let color: Color = section.difficulty == 1 ? .appSuccess : section.difficulty == 3 ? .appDanger : .appAccent
        let mastered = section.nodes.filter { $0.state == .completed }.count
        return HStack(spacing: 10) {
            Text("\(section.taskNumber)")
                .font(.subheadline.bold())
                .frame(width: 36, height: 36)
                .background(color.opacity(0.18), in: Circle())
                .foregroundStyle(color)
            VStack(alignment: .leading, spacing: 1) {
                Text("Задание \(section.taskNumber)").font(.caption.bold()).foregroundStyle(color)
                Text(section.title).font(.subheadline).foregroundStyle(Color.appFg).lineLimit(1)
            }
            Spacer()
            Text("\(mastered)\u{2009}/\u{2009}\(section.nodes.count)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(Color.appMuted)
        }
        .padding(12)
        .background(color.opacity(0.06))
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(color.opacity(0.25), lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var finishBadge: some View {
        VStack(spacing: 6) {
            HStack(spacing: 2) {
                ForEach(0..<3, id: \.self) { _ in
                    Image(systemName: "star.fill").foregroundStyle(Color.appAccent).font(.title3)
                }
            }
            Text("Финиш").font(.caption).foregroundStyle(Color.appMuted)
        }
        .opacity(0.45)
    }

    private var skeletonSection: some View {
        VStack(spacing: 20) {
            RoundedRectangle(cornerRadius: 16).fill(Color.appBorder.opacity(0.35)).frame(height: 60)
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.appBorder.opacity(0.35))
                    .frame(width: 68, height: 68)
                    .offset(x: zigzagOffsets[i % zigzagOffsets.count])
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let path: SessionPath = try await APIClient.shared.request(.sessionPath)
            sections = path.sections
            error = nil
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Не удалось загрузить путь"
        }
    }

    private func startSubtopic(_ node: PathNode) async {
        guard loadingNodeId == nil else { return }
        loadingNodeId = node.topicId
        defer { loadingNodeId = nil }
        do {
            let session: SubtopicSession = try await APIClient.shared.request(
                .subtopicSession(topicId: node.topicId, count: 5)
            )
            guard !session.tasks.isEmpty else { return }
            router.push(.taskSession(allIds: session.tasks.map(\.id), topicId: node.topicId, origin: .session, initialPage: 0))
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }
}

// MARK: - Node view

private struct PathNodeView: View {
    let node: PathNode
    let xOffset: CGFloat
    let isLoadingTap: Bool
    let onTap: () -> Void

    @State private var pulsing = false

    private let size: CGFloat = 72

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                // Pulse ring (current only)
                if node.state == .current {
                    Circle()
                        .fill(Color.appAccent.opacity(0.20))
                        .frame(width: size + 22, height: size + 22)
                        .scaleEffect(pulsing ? 1.35 : 1.0)
                        .opacity(pulsing ? 0 : 1.0)
                        .onAppear {
                            withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) {
                                pulsing = true
                            }
                        }
                }

                // 3D effect: bottom shadow layer
                Circle()
                    .fill(shadowColor)
                    .frame(width: size, height: size)
                    .offset(y: 5)

                // Top face
                Circle()
                    .fill(faceColor)
                    .frame(width: size, height: size)

                // Icon / spinner
                if isLoadingTap {
                    ProgressView().tint(iconColor)
                } else {
                    Image(systemName: iconName)
                        .font(node.state == .current
                              ? .system(size: 26, weight: .bold)
                              : .system(size: 22, weight: .semibold))
                        .foregroundStyle(iconColor)
                }
            }
            .frame(width: size, height: size + 5)

            Text(node.subtopicNumber)
                .font(.caption.bold())
                .foregroundStyle(labelColor)
            Text(node.title)
                .font(.system(size: 11))
                .foregroundStyle(node.state == .locked ? Color.appMuted.opacity(0.45) : Color.appMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 104)
                .lineLimit(2)
        }
        .offset(x: xOffset)
        .onTapGesture {
            guard node.state != .locked && !isLoadingTap else { return }
            onTap()
        }
    }

    private var faceColor: Color {
        switch node.state {
        case .current:  return Color.appAccent
        case .completed: return Color.appSuccess
        case .locked:   return Color(white: 0.84)
        }
    }

    private var shadowColor: Color {
        darken(faceColor)
    }

    private var iconName: String {
        switch node.state {
        case .current:  return "bolt.fill"
        case .completed: return "checkmark"
        case .locked:   return "lock.fill"
        }
    }

    private var iconColor: Color {
        switch node.state {
        case .current:  return Color.appAccentFg
        case .completed: return .white
        case .locked:   return Color(white: 0.55)
        }
    }

    private var labelColor: Color {
        switch node.state {
        case .current:  return Color.appFg
        case .completed: return Color.appSuccess
        case .locked:   return Color.appMuted.opacity(0.5)
        }
    }

    private func darken(_ color: Color) -> Color {
        let ui = UIColor(color)
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        ui.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return Color(UIColor(hue: h, saturation: min(s * 1.05, 1), brightness: b * 0.65, alpha: a))
    }
}

// MARK: - Embedded plan

private struct _EmbeddedPlanContent: View {
    @Environment(Router.self) private var router
    @Environment(AppState.self) private var appState
    @State private var planOut: PlanOut?
    @State private var sections: [TaskSection] = []
    @State private var loading = true
    @State private var generating = false
    @State private var error: String?
    @State private var loadingNodeId: UUID?

    // Sections reordered by AI plan priority
    private var orderedSections: [TaskSection] {
        guard let groups = planOut?.plan?.groups, !sections.isEmpty else { return sections }
        var map: [Int: TaskSection] = [:]
        for s in sections { map[s.taskNumber] = s }
        var result: [TaskSection] = []
        var seen = Set<Int>()
        for g in groups {
            if let s = map[g.taskNumber], seen.insert(s.taskNumber).inserted {
                result.append(s)
            }
        }
        for s in sections where !seen.contains(s.taskNumber) { result.append(s) }
        return result
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 40) {
                if loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                } else if appState.currentUser?.diagnosticCompletedAt == nil {
                    diagnosticGate
                } else if let plan = planOut?.plan {
                    planPath(plan)
                } else {
                    needsGeneration
                }
                if let e = error {
                    Text(e).foregroundStyle(Color.appDanger).font(.caption)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 20)
            .padding(.bottom, 60)
        }
        .task { await load() }
    }

    // MARK: - States

    private var diagnosticGate: some View {
        VStack(spacing: 20) {
            Image(systemName: "clipboard.fill").font(.system(size: 52)).foregroundStyle(Color.appAccent)
            Text("Сначала диагностика").font(.title2.bold())
            Text("AI составит план, когда увидит твой уровень. 15 минут, 20 заданий.")
                .multilineTextAlignment(.center).foregroundStyle(Color.appMuted)
            PrimaryButton(title: "Пройти диагностику") { router.push(.diagnostic) }
        }
        .padding(.top, 50).padding(.horizontal, 8)
    }

    private var needsGeneration: some View {
        VStack(spacing: 20) {
            Image(systemName: "brain.head.profile").font(.system(size: 52)).foregroundStyle(Color.appAccent)
            Text("Персональный план").font(.title2.bold())
            Text("AI проанализирует результаты и расставит приоритеты подготовки.")
                .multilineTextAlignment(.center).foregroundStyle(Color.appMuted)
            PrimaryButton(title: "Составить план", isLoading: generating) {
                Task { await generate() }
            }
        }
        .padding(.top, 50).padding(.horizontal, 8)
    }

    // MARK: - Plan path (zigzag, AI-ordered)

    @ViewBuilder
    private func planPath(_ plan: StudyPlan) -> some View {
        // AI summary strip
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "brain.head.profile")
                .font(.caption.bold()).foregroundStyle(Color.appAccent)
            Text(plan.summary)
                .font(.caption).foregroundStyle(Color.appFg.opacity(0.85))
                .frame(maxWidth: .infinity, alignment: .leading)
            Button { Task { await generate() } } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.caption).foregroundStyle(Color.appMuted)
            }
            .disabled(generating)
        }
        .padding(12)
        .background(Color.appAccent.opacity(0.07))
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Color.appAccent.opacity(0.18), lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 14))

        // Zigzag sections in AI priority order
        ForEach(orderedSections) { section in
            planSectionBlock(section)
        }

        // Finish
        if !orderedSections.isEmpty {
            VStack(spacing: 6) {
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { _ in
                        Image(systemName: "star.fill").foregroundStyle(Color.appAccent).font(.title3)
                    }
                }
                Text("Финиш").font(.caption).foregroundStyle(Color.appMuted)
            }
            .opacity(0.45)
            .frame(maxWidth: .infinity)
        }
    }

    private func planSectionBlock(_ section: TaskSection) -> some View {
        let color: Color = section.difficulty == 1 ? .appSuccess : section.difficulty == 3 ? .appDanger : .appAccent
        let mastered = section.nodes.filter { $0.state == .completed }.count
        return VStack(spacing: 0) {
            // Section header (same style as path tab)
            HStack(spacing: 10) {
                Text("\(section.taskNumber)")
                    .font(.subheadline.bold())
                    .frame(width: 36, height: 36)
                    .background(color.opacity(0.18), in: Circle())
                    .foregroundStyle(color)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Задание \(section.taskNumber)").font(.caption.bold()).foregroundStyle(color)
                    Text(section.title).font(.subheadline).foregroundStyle(Color.appFg).lineLimit(1)
                }
                Spacer()
                Text("\(mastered)\u{2009}/\u{2009}\(section.nodes.count)")
                    .font(.caption.monospacedDigit()).foregroundStyle(Color.appMuted)
            }
            .padding(12)
            .background(color.opacity(0.06))
            .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(color.opacity(0.25), lineWidth: 1) }
            .clipShape(RoundedRectangle(cornerRadius: 16))

            // Zigzag nodes
            VStack(spacing: 28) {
                ForEach(Array(section.nodes.enumerated()), id: \.offset) { i, node in
                    PathNodeView(
                        node: node,
                        xOffset: zigzagOffsets[i % zigzagOffsets.count],
                        isLoadingTap: loadingNodeId == node.topicId,
                        onTap: { Task { await startSubtopic(node) } }
                    )
                }
            }
            .padding(.top, 24)
        }
    }

    // MARK: - Actions

    private func startSubtopic(_ node: PathNode) async {
        guard loadingNodeId == nil else { return }
        loadingNodeId = node.topicId
        defer { loadingNodeId = nil }
        do {
            let session: SubtopicSession = try await APIClient.shared.request(
                .subtopicSession(topicId: node.topicId, count: 5)
            )
            guard !session.tasks.isEmpty else { return }
            router.push(.taskSession(allIds: session.tasks.map(\.id), topicId: node.topicId, origin: .session, initialPage: 0))
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            async let planTask: PlanOut = APIClient.shared.request(.plan)
            async let pathTask: SessionPath = APIClient.shared.request(.sessionPath)
            let (plan, path) = try await (planTask, pathTask)
            planOut = plan
            sections = path.sections
            error = nil
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }

    private func generate() async {
        generating = true
        defer { generating = false }
        do {
            let plan: StudyPlan = try await APIClient.shared.request(.planGenerate)
            planOut = PlanOut(plan: plan, needsGeneration: false)
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }
}
