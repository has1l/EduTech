import SwiftUI
import UIKit

extension Color {
    static let appBg = Color(light: "FFFFFF", dark: "0A0A0A")
    static let appFg = Color(light: "0A0A0A", dark: "FFFFFF")
    static let appMuted = Color(light: "737373", dark: "A3A3A3")
    static let appBorder = Color(light: "E5E5E5", dark: "262626")
    static let appAccent = Color(hex: "FFD000")
    static let appAccentFg = Color(hex: "0A0A0A")
    static let appSuccess = Color(hex: "22C55E")
    static let appDanger = Color(hex: "EF4444")
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .alphanumerics.inverted)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        let r = Double((v >> 16) & 0xFF) / 255
        let g = Double((v >> 8) & 0xFF) / 255
        let b = Double(v & 0xFF) / 255
        self = Color(red: r, green: g, blue: b)
    }

    init(light: String, dark: String) {
        self = Color(UIColor { trait in
            UIColor(Color(hex: trait.userInterfaceStyle == .dark ? dark : light))
        })
    }
}
