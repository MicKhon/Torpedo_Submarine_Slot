import AppKit
import SwiftUI

enum Theme {
    static let abyss = Color(red: 0.03, green: 0.07, blue: 0.10)
    static let deep = Color(red: 0.05, green: 0.16, blue: 0.20)
    static let lagoon = Color(red: 0.10, green: 0.42, blue: 0.46)
    static let foam = Color(red: 0.86, green: 0.95, blue: 0.93)
    static let brass = Color(red: 0.88, green: 0.70, blue: 0.36)
    static let brassDeep = Color(red: 0.48, green: 0.34, blue: 0.14)
    static let hull = Color(red: 0.08, green: 0.12, blue: 0.15)
    static let danger = Color(red: 0.86, green: 0.28, blue: 0.27)
    static let signal = Color(red: 0.35, green: 0.86, blue: 0.62)
    static let periscope = Color(red: 0.55, green: 0.86, blue: 0.55)

    static func display(_ size: CGFloat) -> Font {
        .custom("Copperplate", size: size)
    }

    static func text(_ size: CGFloat, _ name: String = "AvenirNext-Medium") -> Font {
        .custom(name, size: size)
    }
}

extension Color {
    static func symbolFill(_ symbol: Symbol) -> LinearGradient {
        let pair: (Color, Color)
        switch symbol {
        case .ten, .jack, .queen, .king, .ace:
            pair = (Color(red: 0.16, green: 0.24, blue: 0.30), Color(red: 0.09, green: 0.14, blue: 0.18))
        case .cook:
            pair = (Color(red: 0.45, green: 0.32, blue: 0.18), Color(red: 0.24, green: 0.16, blue: 0.09))
        case .radio:
            pair = (Color(red: 0.12, green: 0.38, blue: 0.42), Color(red: 0.06, green: 0.18, blue: 0.22))
        case .engineer:
            pair = (Color(red: 0.55, green: 0.32, blue: 0.14), Color(red: 0.28, green: 0.15, blue: 0.07))
        case .officer:
            pair = (Color(red: 0.55, green: 0.16, blue: 0.20), Color(red: 0.28, green: 0.07, blue: 0.10))
        case .captain:
            pair = (Color(red: 0.72, green: 0.52, blue: 0.16), Color(red: 0.36, green: 0.24, blue: 0.06))
        case .sonar:
            pair = (Color(red: 0.12, green: 0.45, blue: 0.32), Color(red: 0.05, green: 0.20, blue: 0.16))
        case .mine:
            pair = (Color(red: 0.62, green: 0.18, blue: 0.12), Color(red: 0.28, green: 0.06, blue: 0.05))
        case .depth:
            pair = (Color(red: 0.10, green: 0.40, blue: 0.62), Color(red: 0.04, green: 0.16, blue: 0.30))
        case .periscope:
            pair = (Color(red: 0.20, green: 0.48, blue: 0.28), Color(red: 0.08, green: 0.20, blue: 0.12))
        case .torpedo:
            pair = (Color(red: 0.32, green: 0.36, blue: 0.40), Color(red: 0.12, green: 0.14, blue: 0.16))
        }
        return LinearGradient(colors: [pair.0, pair.1], startPoint: .top, endPoint: .bottom)
    }
}

func credits(_ value: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.groupingSeparator = " "
    return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
}

func spinsWord(_ count: Int) -> String {
    let tail = count % 100
    let digit = count % 10
    if (11...14).contains(tail) { return "пусков" }
    if digit == 1 { return "пуск" }
    if (2...4).contains(digit) { return "пуска" }
    return "пусков"
}

enum Cue {
    static func play(_ name: String) {
        NSSound(named: NSSound.Name(name))?.play()
    }
}
