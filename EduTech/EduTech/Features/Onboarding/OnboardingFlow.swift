import SwiftUI

struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState

    @State private var step: Int = 0
    @State private var grade: Int = 11
    @State private var target: Int = 65
    @State private var examYear: Int = Calendar.current.component(.year, from: Date())
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        ZStack {
            Color.appBg.ignoresSafeArea()
            VStack {
                ProgressView(value: Double(step + 1), total: 3)
                    .tint(Color.appAccent)
                    .padding(.horizontal)
                    .padding(.top, 12)

                TabView(selection: $step) {
                    gradeStep.tag(0)
                    targetStep.tag(1)
                    yearStep.tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                if let e = error {
                    Text(e).foregroundStyle(Color.appDanger).font(.caption).padding(.horizontal)
                }

                HStack(spacing: 12) {
                    if step > 0 {
                        SecondaryButton(title: "Назад") { step -= 1 }
                    }
                    PrimaryButton(
                        title: step == 2 ? "Готово" : "Дальше",
                        isLoading: saving
                    ) {
                        if step < 2 {
                            step += 1
                        } else {
                            Task { await save() }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
    }

    private var gradeStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                Text("К чему готовишься?").font(.largeTitle.bold())
                Text("Выбери экзамен").foregroundStyle(Color.appMuted)
            }
            VStack(spacing: 12) {
                ForEach([(9, "ОГЭ", "9 класс"), (11, "ЕГЭ", "11 класс")], id: \.0) { item in
                    let active = grade == item.0
                    Button {
                        grade = item.0
                        target = item.0 == 9 ? 4 : 65
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(item.1).font(.title2.bold())
                                Text(item.2).font(.caption).foregroundStyle(active ? Color.appAccentFg.opacity(0.7) : Color.appMuted)
                            }
                            Spacer()
                            if active {
                                Image(systemName: "checkmark.circle.fill").font(.title2)
                            }
                        }
                        .padding(20)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(active ? Color.appFg : Color.clear, in: RoundedRectangle(cornerRadius: 20))
                        .overlay {
                            RoundedRectangle(cornerRadius: 20).strokeBorder(active ? Color.clear : Color.appBorder, lineWidth: 1)
                        }
                        .foregroundStyle(active ? Color.appBg : Color.appFg)
                    }
                    .buttonStyle(.plain)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 24).padding(.top, 16)
    }

    private var targetStep: some View {
        let oge = grade == 9
        let options: [(Int, String, String)] = oge
            ? [(3, "3", "Трояк"), (4, "4", "Хорошо"), (5, "5", "Отлично")]
            : [(40, "40+", "Начало"), (55, "55+", "Хорошо"), (65, "65+", "Отлично"), (70, "70", "Максимум")]

        return VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                Text(oge ? "Какую оценку хочешь?" : "Какой балл хочешь?").font(.largeTitle.bold())
                Text(oge ? "Любую — поможем" : "Часть 1: до 70 тестовых баллов")
                    .foregroundStyle(Color.appMuted)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: oge ? 3 : 2), spacing: 12) {
                ForEach(options, id: \.0) { item in
                    let active = target == item.0
                    Button { target = item.0 } label: {
                        VStack(spacing: 4) {
                            Text(item.1).font(.title.bold())
                            Text(item.2).font(.caption).foregroundStyle(active ? Color.appAccentFg.opacity(0.7) : Color.appMuted)
                        }
                        .frame(maxWidth: .infinity, minHeight: 80)
                        .background(active ? Color.appFg : Color.clear, in: RoundedRectangle(cornerRadius: 20))
                        .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(active ? Color.clear : Color.appBorder, lineWidth: 1) }
                        .foregroundStyle(active ? Color.appBg : Color.appFg)
                    }
                    .buttonStyle(.plain)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 24).padding(.top, 16)
    }

    private var yearStep: some View {
        let years = [Calendar.current.component(.year, from: Date()), Calendar.current.component(.year, from: Date()) + 1, Calendar.current.component(.year, from: Date()) + 2]
        return VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Когда экзамен?").font(.largeTitle.bold())
                Text("Год сдачи").foregroundStyle(Color.appMuted)
            }
            HStack(spacing: 12) {
                ForEach(years, id: \.self) { y in
                    let active = examYear == y
                    Button { examYear = y } label: {
                        Text(String(y))
                            .font(.title2.bold())
                            .frame(maxWidth: .infinity, minHeight: 64)
                            .background(active ? Color.appFg : Color.clear, in: RoundedRectangle(cornerRadius: 20))
                            .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(active ? Color.clear : Color.appBorder, lineWidth: 1) }
                            .foregroundStyle(active ? Color.appBg : Color.appFg)
                    }
                    .buttonStyle(.plain)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 24).padding(.top, 16)
    }

    private func save() async {
        saving = true
        error = nil
        defer { saving = false }
        do {
            let user: User = try await APIClient.shared.request(.updateMe(
                grade: grade,
                currentScore: nil,
                targetScore: target,
                examDate: "\(examYear)-06-01",
                name: nil
            ))
            appState.currentUser = user
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Не удалось сохранить"
        }
    }
}
