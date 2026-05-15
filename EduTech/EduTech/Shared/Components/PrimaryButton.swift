import SwiftUI

struct PrimaryButton: View {
    let title: String
    var isLoading: Bool = false
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading { ProgressView().tint(Color.appAccentFg) }
                Text(title).font(.headline)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.appAccent)
        .foregroundStyle(Color.appAccentFg)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .disabled(disabled || isLoading)
        .opacity(disabled ? 0.4 : 1)
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 52)
        }
        .buttonStyle(.bordered)
        .tint(Color.appFg)
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}

struct GlassCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(20)
            .background {
                RoundedRectangle(cornerRadius: 24)
                    .fill(Color.appBg)
                    .glassEffect(in: RoundedRectangle(cornerRadius: 24))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 24)
                    .strokeBorder(Color.appBorder, lineWidth: 1)
            }
    }
}
