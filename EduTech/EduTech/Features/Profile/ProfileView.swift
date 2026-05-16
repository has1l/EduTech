import SwiftUI

struct ProfileView: View {
    @Environment(AppState.self) private var appState

    @State private var grade: Int = 11
    @State private var target: Int = 65
    @State private var examYear: Int = Calendar.current.component(.year, from: Date())
    @State private var saved = false
    @State private var saving = false
    @State private var notificationTime: Date = {
        var dc = DateComponents(); dc.hour = 19; dc.minute = 0
        return Calendar.current.date(from: dc) ?? Date()
    }()
    @State private var notificationsOn: Bool = false
    @State private var streak: Streak?

    private var examYears: [Int] {
        let y = Calendar.current.component(.year, from: Date())
        return [y, y + 1, y + 2]
    }

    private var isOge: Bool { grade == 9 }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                avatarHeader
                streakStrip
                examForm
                notificationsSection
                logoutButton
            }
            .padding(.horizontal, 20).padding(.bottom, 32)
        }
        .background(Color.appBg)
        .navigationTitle("Профиль")
        .task {
            await loadStreak()
            syncFromUser()
            loadNotificationSettings()
        }
    }

    @ViewBuilder
    private var avatarHeader: some View {
        if let user = appState.currentUser {
            VStack(spacing: 8) {
                Circle()
                    .fill(Color.appAccent)
                    .frame(width: 88, height: 88)
                    .overlay {
                        Text((user.name?.first ?? user.email.first ?? "?").uppercased())
                            .font(.largeTitle.bold())
                            .foregroundStyle(Color.appAccentFg)
                    }
                Text(user.name ?? "Аноним").font(.title2.bold())
                Text(user.email).font(.caption).foregroundStyle(Color.appMuted)
            }
            .padding(.top, 8)
        }
    }

    private var streakStrip: some View {
        HStack(spacing: 0) {
            stat(title: "Серия", value: "\(streak?.currentStreak ?? 0)", icon: "flame.fill")
            Divider().frame(height: 50)
            stat(title: "Рекорд", value: "\(streak?.longestStreak ?? 0)", icon: "trophy.fill")
            Divider().frame(height: 50)
            stat(title: "Заморозки", value: "\(streak?.freezesAvailable ?? 0)", icon: "snowflake")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .overlay { RoundedRectangle(cornerRadius: 18).strokeBorder(Color.appBorder, lineWidth: 1) }
    }

    private func stat(title: String, value: String, icon: String) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).foregroundStyle(Color.appAccent)
            Text(value).font(.title3.bold())
            Text(title).font(.caption2).foregroundStyle(Color.appMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var examForm: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Настройки экзамена").font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Text("К чему готовишься").font(.caption).foregroundStyle(Color.appMuted)
                HStack(spacing: 10) {
                    ForEach([(9, "ОГЭ"), (11, "ЕГЭ")], id: \.0) { item in
                        let active = grade == item.0
                        Button {
                            grade = item.0
                            target = item.0 == 9 ? 4 : 65
                        } label: {
                            Text(item.1).font(.subheadline.bold())
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(active ? Color.appFg : Color.clear)
                                .foregroundStyle(active ? Color.appBg : Color.appFg)
                                .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(active ? Color.clear : Color.appBorder, lineWidth: 1) }
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(isOge ? "Какую оценку хочешь?" : "Какой балл хочешь?").font(.caption).foregroundStyle(Color.appMuted)
                let options: [Int] = isOge ? [3, 4, 5] : [40, 55, 65, 70]
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: options.count), spacing: 8) {
                    ForEach(options, id: \.self) { v in
                        let active = target == v
                        Button { target = v } label: {
                            Text(isOge ? "\(v)" : "\(v)+")
                                .font(.headline)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(active ? Color.appFg : Color.clear)
                                .foregroundStyle(active ? Color.appBg : Color.appFg)
                                .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(active ? Color.clear : Color.appBorder, lineWidth: 1) }
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain)
                    }
                }
                if !isOge {
                    Text("Часть 1: задания 1–12, максимум 70 баллов")
                        .font(.caption2).foregroundStyle(Color.appMuted)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Год экзамена").font(.caption).foregroundStyle(Color.appMuted)
                HStack(spacing: 8) {
                    ForEach(examYears, id: \.self) { y in
                        let active = examYear == y
                        Button { examYear = y } label: {
                            Text(String(y)).font(.subheadline.bold())
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(active ? Color.appFg : Color.clear)
                                .foregroundStyle(active ? Color.appBg : Color.appFg)
                                .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(active ? Color.clear : Color.appBorder, lineWidth: 1) }
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain)
                    }
                }
            }

            PrimaryButton(title: saved ? "Сохранено ✓" : "Сохранить", isLoading: saving) {
                Task { await save() }
            }
        }
    }

    private var notificationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Напоминания").font(.headline)
            Toggle(isOn: $notificationsOn) {
                VStack(alignment: .leading) {
                    Text("Ежедневное напоминание").font(.subheadline)
                    Text("Чтобы серия не сгорала").font(.caption).foregroundStyle(Color.appMuted)
                }
            }
            .tint(Color.appAccent)
            .onChange(of: notificationsOn) { _, on in
                Task {
                    if on {
                        let cal = Calendar.current
                        let h = cal.component(.hour, from: notificationTime)
                        let m = cal.component(.minute, from: notificationTime)
                        await LocalNotificationManager.scheduleDaily(hour: h, minute: m)
                        await LocalNotificationManager.scheduleRepeating()
                    } else {
                        LocalNotificationManager.cancel()
                    }
                }
            }
            if notificationsOn {
                DatePicker("Время", selection: $notificationTime, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.compact)
                    .onChange(of: notificationTime) { _, t in
                        Task {
                            let cal = Calendar.current
                            await LocalNotificationManager.scheduleDaily(hour: cal.component(.hour, from: t), minute: cal.component(.minute, from: t))
                        }
                    }
            }
        }
        .padding(16)
        .overlay { RoundedRectangle(cornerRadius: 18).strokeBorder(Color.appBorder, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    private var logoutButton: some View {
        Button {
            Task { await appState.logout() }
        } label: {
            HStack {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                Text("Выйти из аккаунта").font(.subheadline.bold())
            }
            .foregroundStyle(Color.appDanger)
            .frame(maxWidth: .infinity, minHeight: 48)
        }
        .buttonStyle(.plain)
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Color.appDanger.opacity(0.4), lineWidth: 1) }
    }

    private func syncFromUser() {
        guard let u = appState.currentUser else { return }
        grade = (u.grade == 9) ? 9 : 11
        target = u.targetScore ?? (grade == 9 ? 4 : 65)
        if let date = u.examDate, let year = Int(date.prefix(4)) {
            examYear = year
        }
    }

    private func loadStreak() async {
        streak = try? await APIClient.shared.request(.streak)
    }

    private func loadNotificationSettings() {
        if let t = AppDefaults.dailyReminderTime {
            notificationsOn = true
            var dc = DateComponents(); dc.hour = t.hour; dc.minute = t.minute
            if let d = Calendar.current.date(from: dc) { notificationTime = d }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            let user: User = try await APIClient.shared.request(.updateMe(
                grade: grade, currentScore: nil, targetScore: target,
                examDate: "\(examYear)-06-01", name: nil
            ))
            appState.currentUser = user
            saved = true
            try? await Task.sleep(for: .seconds(2))
            saved = false
        } catch {
            // ignore for now
        }
    }
}
