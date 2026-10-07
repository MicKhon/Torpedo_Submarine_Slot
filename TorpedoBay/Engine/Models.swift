import Foundation

/// Original submarine slot. Mechanics are inspired by the underwater
/// "collect a torpedo" genre, with original names, art, and math.
enum GameMode: Equatable {
    case base
    case hunter
    case pack

    var title: String {
        switch self {
        case .base: "Боевой поход"
        case .hunter: "Тихая охота"
        case .pack: "Стая"
        }
    }

    /// Visible rows per reel. The middle pair is taller, like a hull viewport.
    var reelHeights: [Int] {
        switch self {
        case .base, .pack: [2, 3, 4, 4, 3, 2]
        case .hunter: [2, 3, 8, 4, 3, 2]
        }
    }

    var depthLabel: String {
        switch self {
        case .base: "42 м"
        case .hunter: "перископ · 18 м"
        case .pack: "волчья стая · 60 м"
        }
    }
}

enum Symbol: String, Equatable, Hashable, CaseIterable {
    case ten, jack, queen, king, ace
    case cook, radio, engineer, officer, captain
    case sonar, mine, depth, periscope, torpedo

    static let paying: [Symbol] = [
        .ten, .jack, .queen, .king, .ace,
        .cook, .radio, .engineer, .officer, .captain
    ]

    /// Payout in hundredths of the bet, for 3, 4, 5 and 6 connected reels, per way.
    /// Scaled from the classic submarine-slot table so a full reel strip still lands near a 96% demo return.
    static let pays: [Symbol: [Int]] = [
        .ten: [9, 11, 23, 63],
        .jack: [9, 13, 27, 90],
        .queen: [9, 14, 31, 90],
        .king: [11, 16, 32, 126],
        .ace: [11, 16, 36, 126],
        .cook: [13, 18, 40, 144],
        .radio: [13, 22, 54, 180],
        .engineer: [14, 23, 72, 216],
        .officer: [18, 27, 144, 450],
        .captain: [40, 135, 270, 900]
    ]

    var title: String {
        switch self {
        case .ten: "10"
        case .jack: "J"
        case .queen: "Q"
        case .king: "K"
        case .ace: "A"
        case .cook: "Кок"
        case .radio: "Радист"
        case .engineer: "Механик"
        case .officer: "Офицер"
        case .captain: "Капитан"
        case .sonar: "Сонар"
        case .mine: "Мина"
        case .depth: "Глубина"
        case .periscope: "Перископ"
        case .torpedo: "Торпеда"
        }
    }

    var isWild: Bool {
        switch self {
        case .mine, .depth, .periscope, .torpedo: true
        default: false
        }
    }

    static func payoutHundredths(_ symbol: Symbol, reels: Int) -> Int {
        guard let row = pays[symbol], (3...6).contains(reels) else { return 0 }
        return row[reels - 3]
    }
}

struct Cell: Identifiable, Equatable {
    var id: UUID = UUID()
    var symbol: Symbol
    var ways: Int = 1
    /// Shared by every wild of a depth-shift reel. The board reads the max, so it is not summed per cell.
    var depthMultiplier: Int = 0
    /// Tails of a launched stack. They display the symbol but do not add extra ways.
    var reelStack: Bool = false
}

struct SlotPos: Hashable {
    var reel: Int
    var row: Int
}

struct WayWin: Equatable {
    var symbol: Symbol
    var reels: Int
    var ways: Int
    var amount: Int
    var positions: [SlotPos]
}

struct TorpedoTube: Equatable {
    var charge: Int = 0

    static let names = ["Хвост", "Мотор", "Заряд", "Нос"]
    static let roles = ["символ", "wild", "wild", "символ"]

    static var fresh: [TorpedoTube] {
        Array(repeating: TorpedoTube(), count: 4)
    }

    static func clamped(_ value: Int) -> Int {
        min(9, max(0, value))
    }
}

enum Cabinet {
    static let hunterCost = 80
    static let packCost = 400
    static let freeSpins = 8
    static let maxMultiple = 36_000
    static let bets = [1, 2, 5, 10, 20, 40, 50, 100]
    static let startingCredits = 10_000
}

struct SpinInput {
    var mode: GameMode
    var bet: Int
    var sticky: Int
    var tubes: [TorpedoTube]
    var roundWin: Int
    var maxWin: Int
}

enum ReelEvent {
    case landed([[Cell]], notes: [String])
    case nudged(reel: Int, steps: Int, multiplier: Int, grid: [[Cell]])
    case scope(hit: Bool, grid: [[Cell]])
    case charged([TorpedoTube])
    case launched(symbol: Symbol, charges: [Int], grid: [[Cell]], sticky: Int)
    case scored([WayWin], paid: Int, multiplier: Int)
    case blasted(mines: Int, multiplier: Int)
    case fell([[Cell]])
    case abyss
}

struct SpinOutcome {
    var events: [ReelEvent]
    var totalWin: Int
    var finalGrid: [[Cell]]
    var triggered: GameMode?
    var extraSpins: Int
    var sticky: Int
    var tubes: [TorpedoTube]
    var capped: Bool
    var sonarCount: Int
}
