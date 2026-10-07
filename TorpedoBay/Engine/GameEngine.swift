import Foundation

struct SplitMix64: RandomNumberGenerator {
    var state: UInt64

    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}

final class GameEngine {
    private var rng: SplitMix64

    init(seed: UInt64? = nil) {
        let value = seed ?? UInt64.random(in: 1..<UInt64.max)
        rng = SplitMix64(state: value == 0 ? 0xA5A5_F00D_1234_5678 : value)
    }

    func attractGrid(mode: GameMode) -> [[Cell]] {
        let heights = mode.reelHeights
        return heights.enumerated().map { reel, height in
            (0..<height).map { row in
                let symbol = Symbol.paying[(reel * 3 + row) % Symbol.paying.count]
                return Cell(symbol: symbol)
            }
        }
    }

    func spin(_ input: SpinInput) -> SpinOutcome {
        var notes: [String] = []
        var grid = blankGrid(mode: input.mode)
        placeSonars(&grid, mode: input.mode)
        placeMines(&grid)
        let depthPlans = placeDepth(&grid, mode: input.mode, notes: &notes)
        placeCurrents(&grid, notes: &notes)
        if input.mode == .hunter { placePeriscope(&grid) }
        if input.mode == .pack { placeTorpedoParts(&grid) }

        var events: [ReelEvent] = [.landed(grid, notes: notes)]
        for plan in depthPlans where plan.steps > 0 {
            grid = applyDepth(grid, plan: plan)
            events.append(.nudged(reel: plan.reel, steps: plan.steps, multiplier: plan.multiplier, grid: grid))
        }

        var tubes = input.tubes.count == 4 ? input.tubes : TorpedoTube.fresh
        var sticky = input.sticky
        var spinMult = 0
        var total = 0
        var seenSonar = Set<UUID>()
        var firedScope = Set<UUID>()
        var scopeResolved = false
        var capped = false

        func absorbSonars() {
            for reel in grid {
                for cell in reel where cell.symbol == .sonar {
                    seenSonar.insert(cell.id)
                }
            }
        }
        absorbSonars()

        let roomStart = max(0, input.maxWin - input.roundWin)

        for _ in 0..<8 {
            if capped { break }

            if input.mode == .hunter && !scopeResolved {
                if resolvePeriscope(&grid, events: &events, sticky: &sticky, fired: &firedScope) {
                    scopeResolved = true
                }
            }

            if input.mode == .pack {
                resolveTorpedo(&grid, tubes: &tubes, sticky: &sticky, events: &events)
            }

            let multiplier = max(1, sticky + spinMult + Paymaster.depthMultiplier(on: grid))
            let lines = Paymaster.wins(on: grid, bet: input.bet, multiplier: multiplier)
            let raw = lines.reduce(0) { $0 + $1.amount }
            var winPositions = Set(lines.flatMap(\.positions))

            if raw > 0 {
                let room = max(0, roomStart - total)
                let paid = min(raw, room)
                total += paid
                events.append(.scored(lines, paid: paid, multiplier: multiplier))
                if total >= roomStart {
                    capped = true
                    events.append(.abyss)
                }
            }

            if capped { break }

            let minePositions = positions(in: grid, where: { $0.symbol == .mine })
            if lines.isEmpty && minePositions.isEmpty { break }

            if !minePositions.isEmpty {
                if input.mode == .base {
                    spinMult += minePositions.count
                } else {
                    sticky += minePositions.count
                }
                events.append(.blasted(mines: minePositions.count, multiplier: max(1, sticky + spinMult)))
            }

            var remove = Set<SlotPos>()
            for pos in winPositions where cell(grid, pos).symbol != .sonar {
                remove.insert(pos)
            }
            if !minePositions.isEmpty {
                for reel in grid.indices {
                    for row in grid[reel].indices {
                        let symbol = grid[reel][row].symbol
                        let pos = SlotPos(reel: reel, row: row)
                        if symbol == .mine {
                            remove.insert(pos)
                        } else if !symbol.isWild && symbol != .sonar && !winPositions.contains(pos) {
                            remove.insert(pos)
                        }
                    }
                }
            }

            winPositions.removeAll()
            if remove.isEmpty { break }
            grid = collapse(grid, removing: remove, mode: input.mode)
            absorbSonars()
            events.append(.fell(grid))
        }

        let sonarCount = seenSonar.count
        var triggered: GameMode?
        var extra = 0
        if !capped {
            if input.mode == .base {
                if sonarCount >= 4 {
                    triggered = .pack
                } else if sonarCount >= 3 {
                    triggered = .hunter
                }
                if triggered != nil {
                    sticky += spinMult
                }
            } else {
                extra = sonarCount * 2
            }
        }

        return SpinOutcome(
            events: events,
            totalWin: total,
            finalGrid: grid,
            triggered: triggered,
            extraSpins: extra,
            sticky: sticky,
            tubes: input.mode == .pack ? tubes : TorpedoTube.fresh,
            capped: capped,
            sonarCount: sonarCount
        )
    }

    private struct DepthPlan {
        var reel: Int
        var steps: Int
        var multiplier: Int
    }

    private static let reelWeights: [(Symbol, Int)] = [
        (.ten, 120), (.jack, 110), (.queen, 100), (.king, 90), (.ace, 74),
        (.cook, 48), (.radio, 40), (.engineer, 32), (.officer, 22), (.captain, 14)
    ]

    private static let launchWeights: [(Symbol, Int)] = [
        (.ten, 4), (.jack, 8), (.queen, 10), (.king, 14), (.ace, 16),
        (.cook, 16), (.radio, 18), (.engineer, 18), (.officer, 20), (.captain, 22)
    ]

    private func blankGrid(mode: GameMode) -> [[Cell]] {
        mode.reelHeights.map { height in
            (0..<height).map { _ in Cell(symbol: pick(Self.reelWeights)) }
        }
    }

    private func placeSonars(_ grid: inout [[Cell]], mode: GameMode) {
        let chance = mode == .base ? 0.112 : 0.07
        for reel in 1...4 where self.chance(chance) {
            overwritePaying(&grid, reel: reel, symbol: .sonar)
        }
    }

    private func placeMines(_ grid: inout [[Cell]]) {
        guard chance(0.075), let spot = randomPayingSpot(grid) else { return }
        grid[spot.reel][spot.row] = Cell(symbol: .mine)
        if chance(0.22), let second = randomPayingSpot(grid) {
            grid[second.reel][second.row] = Cell(symbol: .mine)
        }
    }

    private func placeDepth(_ grid: inout [[Cell]], mode: GameMode, notes: inout [String]) -> [DepthPlan] {
        let reels = mode == .hunter ? [3] : [2, 3]
        var plans: [DepthPlan] = []
        for reel in reels where grid[reel].count >= 4 && chance(0.082) {
            let visible = Int.random(in: 1...4, using: &rng)
            let steps = 4 - visible
            let multiplier = 1 + steps
            let fromTop = chance(0.5)
            let rows = fromTop ? Array(0..<visible) : Array((4 - visible)..<4)
            for row in rows {
                grid[reel][row] = Cell(symbol: .depth, ways: 1, depthMultiplier: steps == 0 ? multiplier : 0)
            }
            if steps == 0 {
                notes.append("Глубина на барабане \(reel + 1) сразу в створе · ×\(multiplier)")
            }
            plans.append(DepthPlan(reel: reel, steps: steps, multiplier: multiplier))
        }
        return plans
    }

    private func applyDepth(_ grid: [[Cell]], plan: DepthPlan) -> [[Cell]] {
        var grid = grid
        for row in grid[plan.reel].indices {
            grid[plan.reel][row] = Cell(symbol: .depth, ways: 1, depthMultiplier: plan.multiplier)
        }
        return grid
    }

    private func placeCurrents(_ grid: inout [[Cell]], notes: inout [String]) {
        var shared: Symbol?
        for reel in [1, 4] where chance(0.125) {
            if shared == nil { shared = pick(Self.reelWeights) }
            guard let symbol = shared else { continue }
            let size = Int.random(in: 2...3, using: &rng)
            overwritePaying(&grid, reel: reel) { _ in
                Cell(symbol: symbol, ways: size)
            }
            notes.append("Течение на барабане \(reel + 1): \(symbol.title) ×\(size)")
        }
    }

    private func placePeriscope(_ grid: inout [[Cell]]) {
        guard chance(0.24) else { return }
        overwritePaying(&grid, reel: 2, symbol: .periscope)
    }

    private func placeTorpedoParts(_ grid: inout [[Cell]]) {
        for reel in 1...4 where chance(0.24) {
            overwritePaying(&grid, reel: reel, symbol: .torpedo)
        }
    }

    @discardableResult
    private func resolvePeriscope(_ grid: inout [[Cell]], events: inout [ReelEvent], sticky: inout Int, fired: inout Set<UUID>) -> Bool {
        let fresh = grid[2].filter { $0.symbol == .periscope && !fired.contains($0.id) }
        guard !fresh.isEmpty, hasAim(grid) else { return false }
        for cell in fresh { fired.insert(cell.id) }

        let hit = chance(0.5)
        if hit {
            sticky += 1
            for row in grid[2].indices {
                let cell = Cell(symbol: .periscope, ways: 1, depthMultiplier: 8)
                grid[2][row] = cell
                fired.insert(cell.id)
            }
        }
        events.append(.scope(hit: hit, grid: grid))
        return true
    }

    private func hasAim(_ grid: [[Cell]]) -> Bool {
        Symbol.paying.contains { symbol in
            reelConnects(symbol, reel: 0, grid: grid) && reelConnects(symbol, reel: 1, grid: grid)
        }
    }

    private func reelConnects(_ symbol: Symbol, reel: Int, grid: [[Cell]]) -> Bool {
        grid[reel].contains { $0.ways > 0 && ($0.symbol == symbol || $0.symbol.isWild) }
    }

    private func resolveTorpedo(_ grid: inout [[Cell]], tubes: inout [TorpedoTube], sticky: inout Int, events: inout [ReelEvent]) {
        let bombBonus = grid.contains { reel in reel.contains { $0.symbol == .mine } } ? 1 : 0
        var changed = false
        for reel in 1...4 {
            let parts = grid[reel].filter { $0.symbol == .torpedo }.count
            guard parts > 0 else { continue }
            for _ in 0..<parts {
                let index = reel - 1
                let base = tubes[index].charge == 0 ? 2 : 1
                tubes[index].charge = TorpedoTube.clamped(tubes[index].charge + base + bombBonus)
                changed = true
            }
        }
        if changed {
            events.append(.charged(tubes))
        }
        guard tubes.allSatisfy({ $0.charge > 0 }) else { return }

        let symbol = pick(Self.launchWeights)
        let charges = tubes.map(\.charge)
        for (offset, reel) in [1, 2, 3, 4].enumerated() {
            let wildReel = reel == 2 || reel == 3
            for row in grid[reel].indices {
                if wildReel {
                    grid[reel][row] = Cell(
                        symbol: .depth,
                        ways: row == 0 ? charges[offset] : 0,
                        reelStack: true
                    )
                } else {
                    grid[reel][row] = Cell(
                        symbol: symbol,
                        ways: row == 0 ? charges[offset] : 0,
                        reelStack: true
                    )
                }
            }
        }
        sticky += 1
        tubes = TorpedoTube.fresh
        events.append(.launched(symbol: symbol, charges: charges, grid: grid, sticky: sticky))
    }

    private func collapse(_ grid: [[Cell]], removing: Set<SlotPos>, mode: GameMode) -> [[Cell]] {
        grid.enumerated().map { reel, column in
            let kept = column.enumerated().compactMap { row, cell -> Cell? in
                removing.contains(SlotPos(reel: reel, row: row)) ? nil : cell
            }
            let missing = column.count - kept.count
            let fresh = (0..<missing).map { _ in refillCell(reel: reel, mode: mode) }
            return fresh + kept
        }
    }

    private func refillCell(reel _: Int, mode _: GameMode) -> Cell {
        Cell(symbol: pick(Self.reelWeights))
    }

    private func overwritePaying(_ grid: inout [[Cell]], reel: Int, symbol: Symbol) {
        overwritePaying(&grid, reel: reel) { _ in Cell(symbol: symbol) }
    }

    private func overwritePaying(_ grid: inout [[Cell]], reel: Int, make: (Int) -> Cell) {
        let rows = grid[reel].indices.filter { Symbol.paying.contains(grid[reel][$0].symbol) }
        guard !rows.isEmpty else { return }
        let row = rows[Int.random(in: 0..<rows.count, using: &rng)]
        grid[reel][row] = make(row)
    }

    private func randomPayingSpot(_ grid: [[Cell]]) -> SlotPos? {
        var spots: [SlotPos] = []
        for reel in grid.indices {
            for row in grid[reel].indices where Symbol.paying.contains(grid[reel][row].symbol) {
                spots.append(SlotPos(reel: reel, row: row))
            }
        }
        guard !spots.isEmpty else { return nil }
        return spots[Int.random(in: 0..<spots.count, using: &rng)]
    }

    private func positions(in grid: [[Cell]], where match: (Cell) -> Bool) -> [SlotPos] {
        var found: [SlotPos] = []
        for reel in grid.indices {
            for row in grid[reel].indices where match(grid[reel][row]) {
                found.append(SlotPos(reel: reel, row: row))
            }
        }
        return found
    }

    private func cell(_ grid: [[Cell]], _ pos: SlotPos) -> Cell {
        grid[pos.reel][pos.row]
    }

    private func pick(_ weights: [(Symbol, Int)]) -> Symbol {
        let total = weights.reduce(0) { $0 + $1.1 }
        var roll = Int.random(in: 0..<total, using: &rng)
        for (symbol, weight) in weights {
            if roll < weight { return symbol }
            roll -= weight
        }
        return weights[0].0
    }

    private func chance(_ probability: Double) -> Bool {
        Double.random(in: 0..<1, using: &rng) < probability
    }
}
