import Foundation

func cell(_ symbol: Symbol, ways: Int = 1, depth: Int = 0, stack: Bool = false) -> Cell {
    Cell(symbol: symbol, ways: ways, depthMultiplier: depth, reelStack: stack)
}

func assertEqual(_ got: Int, _ want: Int, _ name: String) {
    if got != want {
        fputs("FAIL \(name): got \(got), want \(want)\n", stderr)
        exit(1)
    }
}

func onlyCaptain() -> Int {
    let grid: [[Cell]] = [
        [cell(.captain), cell(.ten)],
        [cell(.captain), cell(.jack), cell(.queen)],
        [cell(.captain), cell(.ace), cell(.cook), cell(.king)],
        [cell(.officer), cell(.radio), cell(.engineer), cell(.cook)],
        [cell(.ten), cell(.jack), cell(.queen)],
        [cell(.ace), cell(.king)]
    ]
    let wins = Paymaster.wins(on: grid, bet: 100, multiplier: 1)
    assertEqual(wins.count, 1, "single captain win")
    assertEqual(wins[0].amount, 40, "captain 3oak one way")
    assertEqual(wins[0].ways, 1, "one way")
    return wins[0].amount
}

func doubledAndStacked() {
    var grid: [[Cell]] = [
        [cell(.captain), cell(.captain)],
        [cell(.captain, ways: 3), cell(.jack), cell(.queen)],
        [cell(.ace), cell(.cook), cell(.king), cell(.officer)],
        [cell(.radio), cell(.engineer), cell(.cook), cell(.ten)],
        [cell(.jack), cell(.queen), cell(.king)],
        [cell(.ace), cell(.ten)]
    ]
    var wins = Paymaster.wins(on: grid, bet: 100, multiplier: 1)
    let captain = wins.first { $0.symbol == .captain }
    // reels 0 and 1 only — reel 2 has no captain, so this is NOT a win
    if captain != nil {
        fputs("FAIL stacked should not pay on 2 reels\n", stderr)
        exit(1)
    }

    grid[2][0] = cell(.captain)
    wins = Paymaster.wins(on: grid, bet: 100, multiplier: 1)
    let hit = wins.first { $0.symbol == .captain }!
    // ways = 2 * 3 * 1 = 6, pay 0.40x => 40 * 6 = 240
    assertEqual(hit.ways, 6, "current ways")
    assertEqual(hit.amount, 240, "current payout")
    assertEqual(Paymaster.wins(on: grid, bet: 100, multiplier: 4).first { $0.symbol == .captain }!.amount, 960, "multiplier adds as factor")
}

func wildReel() {
    let grid: [[Cell]] = [
        [cell(.officer), cell(.ten)],
        [cell(.officer), cell(.jack), cell(.queen)],
        [cell(.depth), cell(.depth), cell(.depth), cell(.depth)],
        [cell(.officer), cell(.ace), cell(.cook), cell(.king)],
        [cell(.ten), cell(.jack), cell(.queen)],
        [cell(.ace), cell(.king)]
    ]
    let wins = Paymaster.wins(on: grid, bet: 100, multiplier: 1)
    let officer = wins.first { $0.symbol == .officer }!
    // 1 * 1 * 4 * 1 = 4 ways, 4 reels, officer pay index 1 = 60 hundredths
    assertEqual(officer.reels, 4, "officer reels")
    assertEqual(officer.ways, 4, "wild reel ways")
    assertEqual(officer.amount, 108, "officer 4oak")
}

func noNatural() {
    let grid: [[Cell]] = [
        [cell(.depth), cell(.mine)],
        [cell(.depth), cell(.mine), cell(.periscope)],
        [cell(.periscope), cell(.depth), cell(.torpedo), cell(.depth)],
        [cell(.mine), cell(.depth), cell(.periscope), cell(.torpedo)],
        [cell(.depth), cell(.mine), cell(.torpedo)],
        [cell(.sonar), cell(.depth)]
    ]
    let wins = Paymaster.wins(on: grid, bet: 100, multiplier: 1)
    if !wins.isEmpty {
        fputs("FAIL wilds alone should not pay\n", stderr)
        exit(1)
    }
}

func launchedStack() {
    let grid: [[Cell]] = [
        [cell(.captain), cell(.ten)],
        [
            cell(.captain, ways: 9, stack: true),
            cell(.captain, ways: 0, stack: true),
            cell(.captain, ways: 0, stack: true)
        ],
        [
            cell(.depth, ways: 4, stack: true),
            cell(.depth, ways: 0, stack: true),
            cell(.depth, ways: 0, stack: true),
            cell(.depth, ways: 0, stack: true)
        ],
        [cell(.cook), cell(.ace), cell(.king), cell(.queen)],
        [cell(.jack), cell(.queen), cell(.king)],
        [cell(.ace), cell(.ten)]
    ]
    let wins = Paymaster.wins(on: grid, bet: 10, multiplier: 2)
    let captain = wins.first { $0.symbol == .captain }!
    // 1 * 9 * 4 = 36 ways, 3 reels, 0.40x, bet 10, mult 2
    // 10 * 40 * 36 * 2 / 100 = 288
    assertEqual(captain.ways, 36, "launch ways")
    assertEqual(captain.amount, 288, "launch payout")
    assertEqual(captain.positions.count, 1 + 3 + 4, "stack highlights whole reels")
}

@main
struct Audit {
    static func main() {
        _ = onlyCaptain()
        doubledAndStacked()
        wildReel()
        noNatural()
        launchedStack()
        fputs("fixtures ok\n", stderr)

        let engine = GameEngine(seed: 42)
        let spins = 40_000
        let bet = 10
        var wagered = 0
        var won = 0
        var baseWon = 0
        var bonusWon = 0
        var baseHits = 0
        var hunter = 0
        var pack = 0
        var launches = 0
        var hunterHits = 0
        var maxHit = 0
        var bonusSpins = 0

        for _ in 0..<spins {
            wagered += bet
            let opening = engine.spin(SpinInput(
                mode: .base, bet: bet, sticky: 0, tubes: TorpedoTube.fresh,
                roundWin: 0, maxWin: bet * Cabinet.maxMultiple
            ))
            if opening.totalWin > 0 { baseHits += 1 }
            baseWon += opening.totalWin
            var round = opening.totalWin
            if let mode = opening.triggered, !opening.capped {
                if mode == .hunter { hunter += 1 } else { pack += 1 }
                var left = Cabinet.freeSpins
                var sticky = opening.sticky
                var tubes = TorpedoTube.fresh
                while left > 0 && round < bet * Cabinet.maxMultiple {
                    left -= 1
                    bonusSpins += 1
                    let outcome = engine.spin(SpinInput(
                        mode: mode, bet: bet, sticky: sticky, tubes: tubes,
                        roundWin: round, maxWin: bet * Cabinet.maxMultiple
                    ))
                    round += outcome.totalWin
                    left += outcome.extraSpins
                    sticky = outcome.sticky
                    tubes = outcome.tubes
                    if outcome.events.contains(where: { if case .launched = $0 { return true }; return false }) {
                        launches += 1
                    }
                    if outcome.events.contains(where: { if case .scope(let hit, _) = $0 { return hit }; return false }) {
                        hunterHits += 1
                    }
                    if outcome.capped { break }
                    if bonusSpins > spins * 4 { break }
                }
            }
            won += round
            bonusWon += round - opening.totalWin
            maxHit = max(maxHit, round)
        }

        let rtp = Double(won) / Double(wagered)
        print(String(format: "spins %d  rtp %.3f  baseRTP %.3f  bonusRTP %.3f  hitRate %.3f  hunter %d  pack %d  launches %d  scopeHits %d  bonusSpins %d  max %.1fx",
                     spins, rtp, Double(baseWon) / Double(wagered), Double(bonusWon) / Double(wagered),
                     Double(baseHits) / Double(spins), hunter, pack, launches, hunterHits, bonusSpins, Double(maxHit) / Double(bet)))
    }
}
