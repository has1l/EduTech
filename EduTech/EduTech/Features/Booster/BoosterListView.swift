import SwiftUI

struct BoosterListView: View {
    @Environment(Router.self) private var router
    @Environment(AppState.self) private var appState
    @State private var items: [BoosterItem] = []
    @State private var nodesMap: [UUID: PathNode] = [:]
    @State private var pathSections: [TaskSection] = []
    @State private var isLoading = true
    @State private var error: String?

    private struct BoosterGroup: Identifiable {
        let taskNum: Int
        let sectionTitle: String
        let difficulty: Int
        let items: [BoosterItem]
        var id: Int { taskNum }
    }

    private var groups: [BoosterGroup] {
        var dict: [Int: (String, Int, [BoosterItem])] = [:]
        for item in items {
            let node = item.topicId.flatMap { nodesMap[$0] }
            let num = node?.taskNumber ?? 0
            let sec = pathSections.first { $0.taskNumber == num }
            let title = sec?.title ?? (num > 0 ? "Задание \(num)" : "Прочее")
            let diff = sec?.difficulty ?? 2
            if dict[num] == nil { dict[num] = (title, diff, []) }
            dict[num]!.2.append(item)
        }
        return dict.sorted { $0.key < $1.key }
            .map { BoosterGroup(taskNum: $0.key, sectionTitle: $0.value.0, difficulty: $0.value.1, items: $0.value.2) }
    }

    var body: some View {
        List {
            if isLoading {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .listRowBackground(Color.clear)
                    .padding(.top, 40)
            } else if items.isEmpty {
                emptySection
            } else {
                startSection
                ForEach(groups) { group in
                    Section {
                        ForEach(group.items) { item in
                            itemRow(item: item, in: group)
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        Task { await delete(item) }
                                    } label: {
                                        Label("Удалить", systemImage: "trash")
                                    }
                                }
                        }
                    } header: {
                        sectionHeader(group)
                    }
                }
                if let e = error {
                    Text(e)
                        .foregroundStyle(Color.appDanger)
                        .font(.caption)
                        .listRowBackground(Color.clear)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.appBg)
        .navigationTitle("Бустер")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
        .refreshable { await load() }
    }

    // MARK: - Empty state

    @ViewBuilder
    private var emptySection: some View {
        Section {
            VStack(spacing: 16) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Color.appAccent)
                Text("Бустер пуст")
                    .font(.title3.bold())
                Text("Сюда попадают задачи, которые ты пропустил или решил с помощью AI")
                    .font(.subheadline)
                    .foregroundStyle(Color.appMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.vertical, 52)
            .frame(maxWidth: .infinity)
            .listRowBackground(Color.clear)
        }
    }

    // MARK: - Start banner

    @ViewBuilder
    private var startSection: some View {
        Section {
            Button {
                let ids = items.map(\.taskId)
                router.push(.taskSession(allIds: ids, topicId: nil, origin: .booster, initialPage: 0))
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "bolt.fill")
                        .font(.title2)
                        .foregroundStyle(Color.appAccentFg)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Начать повторение")
                            .font(.headline)
                            .foregroundStyle(Color.appAccentFg)
                        Text("\(items.count) \(pluralTask(items.count))")
                            .font(.caption)
                            .foregroundStyle(Color.appAccentFg.opacity(0.7))
                    }
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.subheadline.bold())
                        .foregroundStyle(Color.appAccentFg.opacity(0.8))
                }
                .padding(.vertical, 6)
            }
            .listRowBackground(Color.appAccent)
        }
    }

    // MARK: - Section header

    private func sectionHeader(_ group: BoosterGroup) -> some View {
        let color: Color = group.difficulty == 1 ? .appSuccess
            : group.difficulty == 3 ? .appDanger : .appAccent
        return HStack(spacing: 8) {
            Text("\(group.taskNum)")
                .font(.caption2.bold())
                .foregroundStyle(Color.appAccentFg)
                .frame(width: 22, height: 22)
                .background(color, in: Circle())
            Text(group.sectionTitle)
                .font(.subheadline.bold())
                .foregroundStyle(Color.appFg)
            Spacer()
            Text("\(group.items.count)")
                .font(.caption)
                .foregroundStyle(Color.appMuted)
        }
        .textCase(nil)
        .padding(.vertical, 2)
    }

    // MARK: - Item row

    private func itemRow(item: BoosterItem, in group: BoosterGroup) -> some View {
        let node = item.topicId.flatMap { nodesMap[$0] }
        let idx = group.items.firstIndex(where: { $0.taskId == item.taskId }) ?? 0
        return Button {
            let ids = group.items.map(\.taskId)
            router.push(.taskSession(allIds: ids, topicId: nil, origin: .booster, initialPage: idx))
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    if let n = node {
                        Text("\(n.subtopicNumber) · \(n.title)")
                            .font(.subheadline)
                            .lineLimit(2)
                            .foregroundStyle(Color.appFg)
                    } else {
                        Text(item.questionPreview.isEmpty ? "Задача" : item.questionPreview)
                            .font(.subheadline)
                            .lineLimit(2)
                            .foregroundStyle(Color.appFg)
                    }
                    HStack(spacing: 6) {
                        Circle()
                            .fill(item.reason == "ai" ? Color.appAccent : Color.appMuted.opacity(0.5))
                            .frame(width: 6, height: 6)
                        Text(item.reason == "ai" ? "Решено с AI" : "Пропущена")
                            .font(.caption)
                            .foregroundStyle(item.reason == "ai" ? Color.appAccent : Color.appMuted)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(Color.appBorder)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Data

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let boosterReq: [BoosterItem] = APIClient.shared.request(.booster)
            async let pathReq: SessionPath = APIClient.shared.request(.sessionPath)
            let fetchedItems = try await boosterReq
            let path = try await pathReq
            items = fetchedItems
            pathSections = path.sections
            nodesMap = Dictionary(
                uniqueKeysWithValues: path.sections.flatMap(\.nodes).map { ($0.topicId, $0) }
            )
            appState.boosterCount = items.count
            error = nil
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Не удалось загрузить"
            isLoading = false
        }
    }

    private func delete(_ item: BoosterItem) async {
        items.removeAll { $0.taskId == item.taskId }
        appState.boosterCount = items.count
        try? await APIClient.shared.requestVoid(.boosterRemove(item.taskId))
    }

    private func pluralTask(_ n: Int) -> String {
        let m10 = n % 10, m100 = n % 100
        if m10 == 1 && m100 != 11 { return "задание" }
        if (2...4).contains(m10) && !(11...14).contains(m100) { return "задания" }
        return "заданий"
    }
}
