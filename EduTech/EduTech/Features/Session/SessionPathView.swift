import SwiftUI

struct SessionPathView: View {
    @Environment(Router.self) private var router
    @State private var sections: [TaskSection] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                } else if let e = error {
                    Text(e).foregroundStyle(Color.appDanger)
                } else {
                    ForEach(sections) { section in
                        sectionView(section)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .background(Color.appBg)
        .navigationTitle("Путь")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
        .refreshable { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Сегодня").font(.system(.largeTitle, design: .rounded).weight(.heavy))
                    Text("Иди по пути, освой все 12 заданий").font(.subheadline).foregroundStyle(Color.appMuted)
                }
                Spacer()
            }
            HStack(spacing: 10) {
                NavigationLink(value: Route.studyPlan) {
                    Label("Мой план", systemImage: "brain.head.profile")
                        .font(.subheadline.bold())
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Color.appAccent.opacity(0.18))
                        .foregroundStyle(Color.appAccent)
                        .clipShape(Capsule())
                }
                NavigationLink(value: Route.diagnostic) {
                    Label("Диагностика", systemImage: "clipboard")
                        .font(.subheadline.bold())
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Color.appBorder.opacity(0.3))
                        .foregroundStyle(Color.appFg)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private func sectionView(_ section: TaskSection) -> some View {
        let mastered = section.nodes.filter { $0.correctCount >= 5 }.count
        let color: Color = section.difficulty == 1 ? .appSuccess : section.difficulty == 3 ? .appDanger : .appAccent

        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Text("\(section.taskNumber)")
                    .font(.caption.bold())
                    .frame(width: 22, height: 22)
                    .background(color, in: Circle())
                    .foregroundStyle(.white)
                Text(section.title).font(.headline)
                Spacer()
                Text("\(mastered)/\(section.nodes.count)").font(.caption.monospacedDigit()).foregroundStyle(Color.appMuted)
            }
            VStack(spacing: 8) {
                ForEach(section.nodes) { node in
                    nodeRow(node, accent: color)
                }
            }
        }
        .padding(16)
        .background(Color.appBg)
        .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    @ViewBuilder
    private func nodeRow(_ node: PathNode, accent: Color) -> some View {
        let mastered = node.correctCount >= 5
        let inProgress = node.correctCount > 0 && !mastered
        let dotColor: Color = mastered ? .appSuccess : inProgress ? accent : Color.appBorder
        let locked = node.state == .locked

        Button {
            guard !locked else { return }
            Task { await startSubtopic(node) }
        } label: {
            HStack(spacing: 12) {
                Circle().fill(dotColor).frame(width: 12, height: 12)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(node.subtopicNumber)  \(node.title)").font(.subheadline)
                        .foregroundStyle(locked ? Color.appMuted : Color.appFg)
                        .multilineTextAlignment(.leading)
                    if !locked {
                        Text("\(node.correctCount)/5").font(.caption2.monospacedDigit()).foregroundStyle(Color.appMuted)
                    }
                }
                Spacer()
                if locked {
                    Image(systemName: "lock.fill").foregroundStyle(Color.appMuted)
                } else {
                    Image(systemName: "chevron.right").foregroundStyle(Color.appMuted)
                }
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .disabled(locked)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let path: SessionPath = try await APIClient.shared.request(.sessionPath)
            self.sections = path.sections
            error = nil
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Не удалось загрузить путь"
        }
    }

    private func startSubtopic(_ node: PathNode) async {
        do {
            let session: SubtopicSession = try await APIClient.shared.request(.subtopicSession(topicId: node.topicId, count: 5))
            guard let first = session.tasks.first else { return }
            let allIds = session.tasks.map(\.id)
            let queue = Array(allIds.dropFirst())
            router.push(.task(id: first.id, queue: queue, total: allIds.count, all: allIds, origin: .session))
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }
}
