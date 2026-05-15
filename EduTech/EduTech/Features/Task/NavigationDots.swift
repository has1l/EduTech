import SwiftUI

struct NavigationDots: View {
    let total: Int
    let currentIndex: Int
    let solved: Set<Int>
    let failed: Set<Int>
    let ai: Set<Int>

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<total, id: \.self) { idx in
                let position = idx + 1
                let color: Color = {
                    if idx == currentIndex { return Color.appFg }
                    if solved.contains(position) { return Color.appSuccess }
                    if ai.contains(position) && !solved.contains(position) { return Color.appAccent }
                    if failed.contains(position) && !solved.contains(position) && !ai.contains(position) { return Color.appDanger }
                    return Color.appBorder
                }()
                Circle()
                    .fill(color)
                    .frame(width: idx == currentIndex ? 10 : 8, height: idx == currentIndex ? 10 : 8)
                    .animation(.smooth, value: color)
            }
        }
    }
}
