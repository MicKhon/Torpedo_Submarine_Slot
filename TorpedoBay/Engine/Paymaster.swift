import Foundation

enum Paymaster {
    static func wins(on grid: [[Cell]], bet: Int, multiplier: Int) -> [WayWin] {
        let mult = max(1, multiplier)
        return Symbol.paying.compactMap { symbol in
            win(for: symbol, grid: grid, bet: bet, multiplier: mult)
        }
    }

    static func depthMultiplier(on grid: [[Cell]]) -> Int {
        grid.reduce(0) { partial, reel in
            partial + (reel.map(\.depthMultiplier).max() ?? 0)
        }
    }

    static func displayedWays(on grid: [[Cell]]) -> Int {
        let counts = grid.map { reel -> Int in
            let sum = reel.reduce(0) { $0 + max(0, $1.ways) }
            return max(1, sum)
        }
        return counts.reduce(1, *)
    }

    private static func win(for symbol: Symbol, grid: [[Cell]], bet: Int, multiplier: Int) -> WayWin? {
        var reelCount = 0
        var ways = 1
        var positions: [SlotPos] = []
        var natural = false

        for reel in grid.indices {
            let hit = contribution(symbol, reel: reel, grid: grid)
            if hit.ways == 0 { break }
            reelCount += 1
            ways *= hit.ways
            positions.append(contentsOf: hit.positions)
            natural = natural || hit.natural
        }

        guard reelCount >= 3, natural, ways > 0 else { return nil }
        let hundredths = Symbol.payoutHundredths(symbol, reels: reelCount)
        let amount = (bet * hundredths * ways * multiplier) / 100
        guard amount > 0 else { return nil }
        return WayWin(symbol: symbol, reels: reelCount, ways: ways, amount: amount, positions: positions)
    }

    private static func contribution(_ symbol: Symbol, reel: Int, grid: [[Cell]]) -> (ways: Int, positions: [SlotPos], natural: Bool) {
        var ways = 0
        var positions: [SlotPos] = []
        var natural = false
        var expands = false

        for row in grid[reel].indices {
            let cell = grid[reel][row]
            let matches = cell.symbol == symbol || cell.symbol.isWild
            guard matches else { continue }
            guard cell.ways > 0 || cell.reelStack else { continue }
            if cell.ways > 0 {
                ways += cell.ways
                if cell.symbol == symbol { natural = true }
            }
            positions.append(SlotPos(reel: reel, row: row))
            if cell.reelStack { expands = true }
        }

        if expands, ways > 0 {
            positions = grid[reel].indices.map { SlotPos(reel: reel, row: $0) }
        }
        return (ways, positions, natural)
    }
}
