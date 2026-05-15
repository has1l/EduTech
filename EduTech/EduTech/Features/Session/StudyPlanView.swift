import SwiftUI

struct StudyPlanView: View {
    @Environment(AppState.self) private var appState
    @Environment(Router.self) private var router
    @State private var planOut: PlanOut?
    @State private var loading = true
    @State private var generating = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                } else if appState.currentUser?.diagnosticCompletedAt == nil {
                    diagnosticGate
                } else if let plan = planOut?.plan {
                    planContent(plan)
                } else {
                    needsGeneration
                }
                if let e = error { Text(e).foregroundStyle(Color.appDanger).font(.caption) }
            }
            .padding(.horizontal, 20).padding(.vertical, 12)
        }
        .background(Color.appBg)
        .navigationTitle("Мой план")
        .task { await load() }
    }

    private var diagnosticGate: some View {
        VStack(spacing: 16) {
            Image(systemName: "clipboard.fill").font(.system(size: 56)).foregroundStyle(Color.appAccent)
            Text("Сначала диагностика").font(.title2.bold())
            Text("AI составит план, когда увидит твой уровень. 15 минут, 20 заданий.")
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appMuted)
            PrimaryButton(title: "Пройти диагностику") {
                router.push(.diagnostic)
            }
        }
        .padding(.top, 60)
        .padding(.horizontal, 8)
    }

    private var needsGeneration: some View {
        VStack(spacing: 16) {
            Image(systemName: "brain.head.profile").font(.system(size: 56)).foregroundStyle(Color.appAccent)
            Text("Составь план с AI").font(.title2.bold())
            Text("Проанализируем твой прогресс и расставим приоритеты")
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appMuted)
            PrimaryButton(title: "Составить план", isLoading: generating) {
                Task { await generate() }
            }
        }
        .padding(.top, 60)
        .padding(.horizontal, 8)
    }

    private func planContent(_ plan: StudyPlan) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(plan.summary).font(.body).foregroundStyle(Color.appFg)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.appAccent.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
            ForEach(plan.groups) { group in
                groupCard(group)
            }
            HStack {
                Spacer()
                Button {
                    Task { await generate() }
                } label: {
                    Label("Обновить", systemImage: "arrow.clockwise").font(.caption)
                }
                .disabled(generating)
            }
        }
    }

    private func groupCard(_ group: PlanGroup) -> some View {
        let color: Color = group.status == .weak ? .appDanger : group.status == .medium ? .appAccent : .appSuccess
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("\(group.taskNumber)").font(.caption.bold())
                    .frame(width: 22, height: 22)
                    .background(color, in: Circle()).foregroundStyle(.white)
                Text(group.title).font(.headline)
                Spacer()
                Text("\(group.masteryPct)%").font(.caption.monospacedDigit().bold()).foregroundStyle(Color.appMuted)
            }
            Text(group.why).font(.subheadline).foregroundStyle(Color.appMuted)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3).fill(Color.appBorder.opacity(0.4))
                    RoundedRectangle(cornerRadius: 3).fill(color)
                        .frame(width: geo.size.width * CGFloat(group.masteryPct) / 100)
                }
            }.frame(height: 6)
        }
        .padding(14)
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            planOut = try await APIClient.shared.request(.plan)
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }

    private func generate() async {
        generating = true
        defer { generating = false }
        do {
            let plan: StudyPlan = try await APIClient.shared.request(.planGenerate)
            self.planOut = PlanOut(plan: plan, needsGeneration: false)
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }
}
