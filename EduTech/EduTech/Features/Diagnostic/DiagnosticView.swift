import SwiftUI

struct DiagnosticView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("Диагностика").font(.largeTitle.bold())
            Text("В разработке").foregroundStyle(Color.appMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBg)
        .navigationTitle("Диагностика")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct DiagnosticResultView: View {
    var body: some View {
        Text("Результат диагностики").font(.title2)
    }
}
