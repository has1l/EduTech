import SwiftUI

struct ProgressOverviewView: View {
    @State private var streak: Streak?
    @State private var pred: ScorePrediction?
    @State private var kb: KBStats?
    @State private var sections: [TaskSection] = []
    @State private var isLoading = true
    @State private var resetSuccess = false
    @State private var isResetting = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                StreakCard(streak: streak)
                ScoreCard(pred: pred, isLoading: pred == nil && isLoading)
                KBCard(kb: kb, allCompleted: allCompleted, isResetting: isResetting, resetSuccess: resetSuccess) {
                    Task { await reset() }
                }
                TopicMap(sections: sections)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(Color.appBg)
        .navigationTitle("Прогресс")
        .task { await load() }
        .refreshable { await load() }
    }

    private var allCompleted: Bool {
        let nodes = sections.flatMap(\.nodes)
        return !nodes.isEmpty && nodes.allSatisfy { $0.correctCount >= 5 }
    }

    private func load() async {
        isLoading = true
        async let s: Streak? = try? APIClient.shared.request(.streak)
        async let p: ScorePrediction? = try? APIClient.shared.request(.scorePrediction)
        async let k: KBStats? = try? APIClient.shared.request(.kbStats)
        async let pathReq: SessionPath? = try? APIClient.shared.request(.sessionPath)
        let (sr, pr, kr, pa) = await (s, p, k, pathReq)
        self.streak = sr
        self.pred = pr
        self.kb = kr
        self.sections = pa?.sections ?? []
        isLoading = false
    }

    private func reset() async {
        isResetting = true
        defer { isResetting = false }
        try? await APIClient.shared.requestVoid(.resetPath)
        try? await APIClient.shared.requestVoid(.kbClear)
        resetSuccess = true
        await load()
    }
}

private struct StreakCard: View {
    let streak: Streak?
    var body: some View {
        let current = streak?.currentStreak ?? 0
        let longest = streak?.longestStreak ?? 0
        let freezes = streak?.freezesAvailable ?? 0
        HStack(spacing: 16) {
            ZStack {
                Circle().fill(Color.appAccent).frame(width: 56, height: 56)
                Image(systemName: "flame.fill").foregroundStyle(Color.appAccentFg).font(.title2)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("\(current) дн. подряд").font(.title2.bold())
                Text("Рекорд: \(longest)  ·  Заморозок: \(freezes)").font(.caption).foregroundStyle(Color.appMuted)
            }
            Spacer()
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay { RoundedRectangle(cornerRadius: 22).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }
}

private struct ScoreCard: View {
    let pred: ScorePrediction?
    let isLoading: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "chart.line.uptrend.xyaxis").foregroundStyle(Color.appMuted)
                Text("Прогноз балла").font(.headline)
                Spacer()
            }
            if isLoading {
                ForEach(0..<3) { _ in
                    RoundedRectangle(cornerRadius: 8).fill(Color.appBorder.opacity(0.3)).frame(height: 28)
                }
            } else if let pred {
                let max = pred.maxPossible
                let target = pred.isOge ? pred.target : min(pred.target, 70)
                bar(title: "Цель", value: target, max: max, color: Color.appFg.opacity(0.45), labelPrefix: pred.isOge ? "Оценка " : "")
                bar(title: "По плану занятий", value: pred.byPlan, max: max, color: Color.appSuccess, labelPrefix: pred.isOge ? "Оценка " : "")
                bar(title: "Если ничего не делать", value: pred.ifNothing, max: max, color: Color.appDanger, labelPrefix: pred.isOge ? "Оценка " : "")
                if !pred.explanation.isEmpty {
                    Text(pred.explanation).font(.caption).foregroundStyle(Color.appMuted)
                }
                if pred.isOge {
                    Text("Прогноз по заданиям 6–19 ОГЭ (Часть 1). Задания 1–5 не входят в курс.")
                        .font(.caption2).foregroundStyle(Color.appMuted.opacity(0.7))
                } else {
                    Text("Прогноз по Части 1 (задания 1–12, до 70 баллов).")
                        .font(.caption2).foregroundStyle(Color.appMuted.opacity(0.7))
                }
            } else {
                Text("Прогноз скоро появится").foregroundStyle(Color.appMuted)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay { RoundedRectangle(cornerRadius: 22).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }

    private func bar(title: String, value: Int, max: Int, color: Color, labelPrefix: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title).font(.caption).foregroundStyle(Color.appMuted)
                Spacer()
                Text("\(labelPrefix)\(value)").font(.caption.bold())
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4).fill(Color.appBorder.opacity(0.4))
                    RoundedRectangle(cornerRadius: 4)
                        .fill(color)
                        .frame(width: geo.size.width * CGFloat(min(value, max)) / CGFloat(max))
                }
            }
            .frame(height: 8)
        }
    }
}

private struct KBCard: View {
    let kb: KBStats?
    let allCompleted: Bool
    let isResetting: Bool
    let resetSuccess: Bool
    let onReset: () -> Void

    var body: some View {
        let count = kb?.count ?? 0
        VStack(spacing: 14) {
            HStack(alignment: .top) {
                HStack(spacing: 12) {
                    Text(kb?.levelEmoji ?? "🌱").font(.system(size: 36))
                    VStack(alignment: .leading, spacing: 0) {
                        Text("База знаний").font(.caption2.bold()).foregroundStyle(Color.appMuted)
                        Text("\(count)").font(.system(size: 32, weight: .black))
                        Text("задач освоено").font(.caption2).foregroundStyle(Color.appMuted)
                    }
                }
                Spacer()
                Text(kb?.levelName ?? "Новичок")
                    .font(.caption.bold())
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.appAccent.opacity(0.25), in: Capsule())
                    .foregroundStyle(Color.appAccent)
            }
            if let kb, let next = kb.nextAt {
                VStack(spacing: 4) {
                    HStack {
                        Text(kb.levelName).font(.caption2).foregroundStyle(Color.appMuted)
                        Spacer()
                        Text("\(count) / \(next)").font(.caption2.monospacedDigit()).foregroundStyle(Color.appMuted)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3).fill(Color.appAccent.opacity(0.2))
                            RoundedRectangle(cornerRadius: 3).fill(Color.appAccent).frame(width: geo.size.width * CGFloat(kb.levelPct / 100))
                        }
                    }.frame(height: 6)
                }
            }
            Button(action: onReset) {
                HStack(spacing: 8) {
                    Image(systemName: isResetting ? "arrow.triangle.2.circlepath" : "arrow.triangle.2.circlepath")
                    Text(isResetting ? "Сброс..." : "Повторение — мать учения").font(.subheadline.bold())
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(allCompleted ? Color.appFg : Color.appBorder.opacity(0.3))
                .foregroundStyle(allCompleted ? Color.appBg : Color.appMuted)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .buttonStyle(.plain)
            .disabled(!allCompleted || isResetting)

            if resetSuccess {
                Text("Прогресс сброшен — все подтипы снова доступны")
                    .font(.caption2).foregroundStyle(Color.appSuccess)
            } else if !allCompleted {
                Text("Пройди все подтипы в пути, чтобы разблокировать сброс")
                    .font(.caption2).foregroundStyle(Color.appMuted)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay { RoundedRectangle(cornerRadius: 22).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }
}

private struct TopicMap: View {
    let sections: [TaskSection]

    var body: some View {
        let allNodes = sections.flatMap(\.nodes)
        let mastered = allNodes.filter { $0.correctCount >= 5 }.count
        let inProgress = allNodes.filter { $0.correctCount > 0 && $0.correctCount < 5 }.count
        let notStarted = allNodes.filter { $0.correctCount == 0 }.count

        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "brain.head.profile").foregroundStyle(Color.appMuted)
                Text("Карта знаний").font(.headline)
            }
            HStack(spacing: 12) {
                Text("\(mastered) освоено").font(.caption.bold()).foregroundStyle(Color.appSuccess)
                Text("\(inProgress) в процессе").font(.caption.bold()).foregroundStyle(Color.appAccent)
                Text("\(notStarted) не начато").font(.caption.bold()).foregroundStyle(Color.appMuted)
            }
            ForEach(sections) { section in
                sectionRow(section)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay { RoundedRectangle(cornerRadius: 22).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }

    @ViewBuilder
    private func sectionRow(_ section: TaskSection) -> some View {
        let mastered = section.nodes.filter { $0.correctCount >= 5 }.count
        let total = section.nodes.count
        let pct = total > 0 ? Double(mastered) / Double(total) : 0
        let color: Color = section.difficulty == 1 ? .appSuccess : section.difficulty == 3 ? .appDanger : .appAccent

        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("\(section.taskNumber)").font(.caption2.bold())
                    .frame(width: 18, height: 18)
                    .background(color, in: Circle()).foregroundStyle(.white)
                Text(section.title).font(.caption.bold()).lineLimit(1)
                Spacer()
                Text("\(mastered)/\(total)").font(.caption2.monospacedDigit()).foregroundStyle(Color.appMuted)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2).fill(Color.appBorder.opacity(0.4))
                    RoundedRectangle(cornerRadius: 2).fill(color).frame(width: geo.size.width * pct)
                }
            }.frame(height: 4)
        }
    }
}
