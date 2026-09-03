import SwiftUI

enum SignalTheme {
    static let ink = Color(red: 23 / 255, green: 34 / 255, blue: 28 / 255)
    static let inkSoft = Color(red: 68 / 255, green: 81 / 255, blue: 73 / 255)
    static let paper = Color(red: 244 / 255, green: 240 / 255, blue: 231 / 255)
    static let paperDeep = Color(red: 235 / 255, green: 229 / 255, blue: 216 / 255)
    static let line = Color(red: 200 / 255, green: 194 / 255, blue: 181 / 255)
    static let coral = Color(red: 255 / 255, green: 101 / 255, blue: 74 / 255)
    static let blue = Color(red: 117 / 255, green: 169 / 255, blue: 255 / 255)
    static let lime = Color(red: 201 / 255, green: 235 / 255, blue: 98 / 255)
    static let white = Color(red: 255 / 255, green: 253 / 255, blue: 248 / 255)

    static func impactColor(_ impact: ImpactLabel) -> Color {
        switch impact {
        case .extraLarge: coral
        case .large: blue
        case .medium: lime
        }
    }
}

enum SignalFormat {
    static let tokyo = TimeZone(identifier: "Asia/Tokyo") ?? .current

    static func date(from value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) {
            return date
        }
        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        return standard.date(from: value)
    }

    static func edition(_ value: String) -> String {
        guard let date = date(from: value) else { return value }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.timeZone = tokyo
        formatter.dateFormat = "yyyy.MM.dd（E）"
        return formatter.string(from: date)
    }

    static func shortDate(_ value: String) -> String {
        guard let date = date(from: value) else { return "--/--" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.timeZone = tokyo
        formatter.dateFormat = "M/d"
        return formatter.string(from: date)
    }

    static func shortTime(_ value: String) -> String {
        guard let date = date(from: value) else { return "--/-- --:--" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.timeZone = tokyo
        formatter.dateFormat = "M/d HH:mm"
        return formatter.string(from: date)
    }
}
