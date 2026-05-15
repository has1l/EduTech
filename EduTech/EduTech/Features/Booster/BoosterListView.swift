import SwiftUI

struct BoosterListView: View {
    @Environment(Router.self) private var router
    @State private var items: [BoosterItem] = []
    @State private var sectionsMap: [UUID: PathNode] = [:]
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if isLoading {
                    ProgressView().padding(.top, 60)
                } else if items.isEmpty {
                    emptyState
                } else {
                    ForEach(items) { item in
                        Button { Task { await launch(item) } } label: {
                            row(item)
                        }
                        .buttonStyle(.plain)
                    }
                }
                if let e = error { Text(e).foregroundStyle(Color.appDanger) }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .background(Color.appBg)
        .navigationTitle("Бустер")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
        .refreshable { await load() }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bolt.fill").font(.system(size: 48)).foregroundStyle(Color.appAccent)
            Text("Бустер пуст").font(.title3.bold())
            Text("Сюда попадают пропущенные или решённые с AI задачи").font(.subheadline).foregroundStyle(Color.appMuted).multilineTextAlignment(.center)
        }
        .padding(.top, 80)
    }

    private func row(_ item: BoosterItem) -> some View {
        HStack(spacing: 12) {
            let node = item.topicId.flatMap { sectionsMap[$0] }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    if let n = node {
                        Text("\(n.taskNumber). \(n.subtopicNumber)")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.appBorder.opacity(0.4), in: Capsule())
                    }
                    Text(item.reason == "ai" ? "С AI" : "Пропущена")
                        .font(.caption2)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(item.reason == "ai" ? Color.appAccent.opacity(0.25) : Color.appDanger.opacity(0.15), in: Capsule())
                }
                Text(item.questionPreview.isEmpty ? (node?.title ?? "Задача") : item.questionPreview)
                    .font(.subheadline)
                    .lineLimit(2)
                    .foregroundStyle(Color.appFg)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(Color.appMuted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let boosterReq: [BoosterItem] = APIClient.shared.request(.booster)
            async let pathReq: SessionPath = APIClient.shared.request(.sessionPath)
            self.items = try await boosterReq
            let path = try await pathReq
            self.sectionsMap = Dictionary(uniqueKeysWithValues: path.sections.flatMap(\.nodes).map { ($0.topicId, $0) })
            self.error = nil
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }

    private func launch(_ item: BoosterItem) async {
        let ids = [item.taskId]
        router.push(.task(id: item.taskId, queue: [], total: ids.count, all: ids, origin: .booster))
    }
}
