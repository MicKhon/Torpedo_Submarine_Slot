import SwiftUI

@MainActor
@Observable
final class GameStore {
    var grid: [[Cell]]
    var balance: Int
    var bet: Int
    var spinWin: Int = 0
    var roundWin: Int = 0
    var mode: GameMode = .base
    var freeSpins: Int = 0
    var sticky: Int = 0
    var tubes: [TorpedoTube] = TorpedoTube.fresh
    var busy = false
    var spinningReels = false
    var highlighted: Set<SlotPos> = []
    var multiplier = 1
    var banner: String?
    var log: [String] = ["Отсек герметичен. Жду приказа на пуск."]
    var scope: ScopePhase?
    var launching = false
    var launchCharges: [Int] = []
    var blastPulse = 0
    var winPulse = 0
    var bigWin = false
    var showPaytable = false
    var showRules = false
    var showSettings = false
    var musicOn: Bool
    var effectsOn: Bool
    var cheatNote = ""
    var autoplayLeft = 0
    var confirmBuy: GameMode?
    var shakeCredits = false

    private let engine: GameEngine
    private var skip = false
    private var roundBet = 10
    private let defaults = UserDefaults.standard

    init() {
        let engine = GameEngine()
        self.engine = engine
        grid = engine.attractGrid(mode: .base)
        let stored = defaults.object(forKey: "tb.balance") as? Int
        balance = stored ?? Cabinet.startingCredits
        bet = defaults.object(forKey: "tb.bet") as? Int ?? 10
        musicOn = defaults.object(forKey: "tb.music") as? Bool ?? true
        effectsOn = defaults.object(forKey: "tb.effects") as? Bool ?? true
        if !Cabinet.bets.contains(bet) { bet = 10 }
    }

    var ways: Int { Paymaster.displayedWays(on: grid) }

    var canChangeBet: Bool { !busy && freeSpins == 0 && mode == .base }

    func stepBet(_ direction: Int) {
        guard canChangeBet, let index = Cabinet.bets.firstIndex(of: bet) else { return }
        let next = index + direction
        guard Cabinet.bets.indices.contains(next) else { return }
        bet = Cabinet.bets[next]
        defaults.set(bet, forKey: "tb.bet")
    }

    func spin() {
        if busy {
            skip = true
            return
        }
        Task { await session(buying: nil) }
    }

    func stopAutoplay() {
        autoplayLeft = 0
        skip = true
    }

    func startAutoplay(_ count: Int) {
        guard !busy else { return }
        autoplayLeft = count
        Task { await session(buying: nil) }
    }

    func requestBuy(_ mode: GameMode) {
        guard canChangeBet else { return }
        confirmBuy = mode
    }

    func confirmPendingBuy() {
        guard let mode = confirmBuy else { return }
        confirmBuy = nil
        Task { await session(buying: mode) }
    }

    func setMusic(_ enabled: Bool) {
        musicOn = enabled
        defaults.set(enabled, forKey: "tb.music")
        SeaScore.shared.musicEnabled = enabled
    }

    func setEffects(_ enabled: Bool) {
        effectsOn = enabled
        defaults.set(enabled, forKey: "tb.effects")
        SeaScore.shared.effectsEnabled = enabled
    }

    func applyCheat(_ raw: String) {
        let cleaned = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
            .replacingOccurrences(of: "-", with: " ")
        let parts = cleaned.split(separator: " ").map(String.init)
        guard parts.first == "KRAKEN" else {
            cheatNote = "Код не принят"
            Cue.play("Pop")
            return
        }
        let grant: Int
        if parts.count >= 2, let value = Int(parts[1]), value > 0 {
            grant = min(value, 5_000_000)
        } else if parts.count == 1 {
            grant = 50_000
        } else {
            cheatNote = "Код не принят"
            return
        }
        balance += grant
        persistBalance()
        cheatNote = "Зачислено \(credits(grant))"
        banner = "Чит принят · +\(credits(grant))"
        push(banner!)
        bigWin = true
        winPulse += 1
        Cue.play("Hero")
    }

    func bootScore() {
        SeaScore.shared.start()
        SeaScore.shared.musicEnabled = musicOn
        SeaScore.shared.effectsEnabled = effectsOn
        SeaScore.shared.setMode(mode)
    }

    func refillCredits() {
        balance = Cabinet.startingCredits
        defaults.set(balance, forKey: "tb.balance")
        push("Трюм пополнен: \(credits(balance)) кредитов.")
    }

    private func session(buying: GameMode?) async {
        if busy { return }
        busy = true
        skip = false
        defer {
            busy = false
            spinningReels = false
            launching = false
            scope = nil
            skip = false
        }

        if let buying {
            let cost = bet * (buying == .hunter ? Cabinet.hunterCost : Cabinet.packCost)
            guard balance >= cost else {
                refuseCredits()
                return
            }
            balance -= cost
            persistBalance()
            roundBet = bet
            roundWin = 0
            spinWin = 0
            sticky = 0
            tubes = TorpedoTube.fresh
            mode = buying
            SeaScore.shared.setMode(buying)
            freeSpins = Cabinet.freeSpins
            grid = engine.attractGrid(mode: buying)
            banner = buying == .hunter ? "Тихая охота · перископ поднят" : "Стая · торпедный отсек открыт"
            push(banner!)
            Cue.play("Submarine")
            await wait(0.45)
        }

        var first = true
        while !Task.isCancelled {
            if freeSpins > 0 {
                freeSpins -= 1
            } else {
                if !first && autoplayLeft <= 0 { break }
                if mode != .base {
                    finishFeature()
                }
                guard balance >= bet else {
                    refuseCredits()
                    autoplayLeft = 0
                    break
                }
                balance -= bet
                persistBalance()
                roundBet = bet
                roundWin = 0
                sticky = 0
                tubes = TorpedoTube.fresh
                multiplier = 1
                if autoplayLeft > 0 { autoplayLeft -= 1 }
            }
            first = false
            spinWin = 0
            highlighted = []
            banner = nil

            multiplier = max(1, sticky)
            let outcome = engine.spin(SpinInput(
                mode: mode,
                bet: roundBet == 0 ? bet : roundBet,
                sticky: sticky,
                tubes: tubes,
                roundWin: roundWin,
                maxWin: (roundBet == 0 ? bet : roundBet) * Cabinet.maxMultiple
            ))
            await present(outcome)

            if outcome.capped {
                freeSpins = 0
                finishFeature()
                break
            }

            if let triggered = outcome.triggered, mode == .base {
                mode = triggered
                SeaScore.shared.setMode(triggered)
                freeSpins = Cabinet.freeSpins
                sticky = outcome.sticky
                tubes = TorpedoTube.fresh
                let title = triggered.title
                banner = "\(title): \(Cabinet.freeSpins) \(spinsWord(Cabinet.freeSpins))"
                push("Сонар засёк \(outcome.sonarCount). \(banner!)")
                Cue.play("Submarine")
                grid = engine.attractGrid(mode: triggered)
                await wait(0.7)
                continue
            }

            if mode != .base {
                sticky = outcome.sticky
                tubes = outcome.tubes
                freeSpins += outcome.extraSpins
                if outcome.extraSpins > 0 {
                    push("Сонар в бонусе: +\(outcome.extraSpins) \(spinsWord(outcome.extraSpins)).")
                }
                if freeSpins > 0 {
                    await wait(0.28)
                    continue
                }
                finishFeature()
            }

            if autoplayLeft > 0 {
                await wait(0.32)
                continue
            }
            break
        }
    }

    private func finishFeature() {
        guard mode != .base else { return }
        if mode == .hunter, grid.count > 2, grid[2].count > 4 {
            grid[2] = Array(grid[2].prefix(4))
        }
        let finished = mode.title
        mode = .base
        SeaScore.shared.setMode(.base)
        sticky = 0
        tubes = TorpedoTube.fresh
        multiplier = 1
        banner = "\(finished) завершена · раунд \(credits(roundWin))"
        push(banner!)
    }

    private func present(_ outcome: SpinOutcome) async {
        var paid = 0
        for event in outcome.events {
            if skip { break }
            paid += await show(event)
        }
        if skip {
            let rest = outcome.totalWin - paid
            if rest > 0 {
                balance += rest
                roundWin += rest
                spinWin += rest
                persistBalance()
            }
            grid = outcome.finalGrid
            if mode == .pack { tubes = outcome.tubes }
            highlighted = []
            launching = false
            scope = nil
            spinningReels = false
        }
    }

    private func show(_ event: ReelEvent) async -> Int {
        switch event {
        case .landed(let next, let notes):
            spinningReels = true
            highlighted = []
            await wait(0.7)
            spinningReels = false
            grid = next
            notes.forEach(push)
            return 0

        case .nudged(let reel, let steps, let mult, let next):
            push("Барабан \(reel + 1) сдвигается на \(steps) · глубина ×\(mult)")
            grid = next
            multiplier = max(multiplier, mult + sticky)
            Cue.play("Pop")
            await wait(0.55)
            return 0

        case .scope(let hit, let next):
            scope = .aiming
            Cue.play("Ping")
            await wait(0.85)
            scope = hit ? .hit : .miss
            grid = next
            if hit {
                push("Попадание. Перископ заполняет барабан и даёт ×8.")
                Cue.play("Glass")
                multiplier = max(1, sticky + Paymaster.depthMultiplier(on: next))
            } else {
                push("Промах. Перископ остаётся одиночным wild.")
            }
            await wait(0.7)
            scope = nil
            return 0

        case .charged(let next):
            tubes = next
            let parts = next.enumerated().map { "\(TorpedoTube.names[$0.offset]) \($0.element.charge)" }.joined(separator: " · ")
            push("Сборка торпеды: \(parts)")
            Cue.play("Tink")
            await wait(0.35)
            return 0

        case .launched(let symbol, let charges, let next, let stickyValue):
            launching = true
            launchCharges = charges
            sticky = stickyValue
            multiplier = max(1, stickyValue)
            push("Торпеда пошла. Фланги — \(symbol.title), центр — wild.")
            Cue.play("Blow")
            await wait(0.35)
            grid = next
            await wait(0.85)
            launching = false
            tubes = TorpedoTube.fresh
            return 0

        case .scored(let lines, let paid, let mult):
            guard paid > 0 else { return 0 }
            highlighted = Set(lines.flatMap(\.positions))
            multiplier = mult
            balance += paid
            roundWin += paid
            spinWin += paid
            persistBalance()
            let best = lines.max { $0.amount < $1.amount }
            if let best {
                banner = "\(best.symbol.title) ×\(best.reels) · \(best.ways) пут. · множитель ×\(mult)"
            }
            if paid >= roundBet * 15 {
                bigWin = true
                winPulse += 1
                Cue.play("Glass")
            } else if paid >= roundBet {
                bigWin = false
                winPulse += 1
                Cue.play("Ping")
            }
            await wait(0.48)
            return paid

        case .blasted(let mines, let mult):
            multiplier = mult
            push(mines == 1 ? "Мина рвёт пустые клетки. Множитель растёт." : "Мины рвут пустые клетки. Множитель растёт.")
            Cue.play("Pop")
            blastPulse += 1
            SeaScore.shared.blast()
            await wait(0.4)
            return 0

        case .fell(let next):
            highlighted = []
            grid = next
            await wait(0.32)
            return 0

        case .abyss:
            banner = "Золото бездны · \(credits(Cabinet.maxMultiple))× ставки"
            push("Всплытие с золотом бездны. Раунд остановлен.")
            Cue.play("Hero")
            await wait(1.1)
            return 0
        }
    }

    private func refuseCredits() {
        banner = "Недостаточно кредитов"
        shakeCredits = true
        push("В трюме пусто. Пополни кредиты в правилах — это демо.")
        Task {
            await wait(0.45)
            shakeCredits = false
        }
    }

    private func push(_ line: String) {
        log.append(line)
        if log.count > 8 { log.removeFirst(log.count - 8) }
    }

    private func persistBalance() {
        defaults.set(balance, forKey: "tb.balance")
    }

    private func wait(_ seconds: Double) async {
        guard seconds > 0 else { return }
        let slices = max(1, Int(seconds / 0.05))
        for _ in 0..<slices {
            if skip { return }
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
    }
}

enum ScopePhase: Equatable {
    case aiming, hit, miss
}
