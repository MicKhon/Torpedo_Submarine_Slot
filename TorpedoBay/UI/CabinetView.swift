import AppKit
import SpriteKit
import SwiftUI

struct CabinetView: View {
    @Bindable var game: GameStore
    @State private var spaceMonitor: Any?
    @State private var fx = SeaFXScene(size: CGSize(width: 1280, height: 860))

    var body: some View {
        ZStack {
            OceanBackground()
            VStack(spacing: 12) {
                header
                board
                TorpedoAssembly(
                    tubes: game.tubes,
                    armed: game.mode == .pack && game.tubes.allSatisfy { $0.charge > 0 },
                    launching: game.launching,
                    active: game.mode == .pack
                )
                logStrip
                controls
            }
            .padding(.horizontal, 22)
            .padding(.top, 16)
            .padding(.bottom, 14)

            if let phase = game.scope {
                ScopeOverlay(phase: phase)
            }
            SpriteView(scene: fx, options: [.allowsTransparency])
                .ignoresSafeArea()
                .allowsHitTesting(false)
        }
        .frame(minWidth: 1040, minHeight: 760)
        .onAppear {
            installSpacebar()
            game.bootScore()
        }
        .onDisappear { removeSpacebar() }
        .onChange(of: game.launching) { _, launching in
            if launching { fx.launchTorpedo() }
        }
        .onChange(of: game.scope) { _, phase in
            switch phase {
            case .aiming: fx.aimTorpedo()
            case .hit: fx.resolveTorpedo(hit: true)
            case .miss: fx.resolveTorpedo(hit: false)
            case nil: break
            }
        }
        .onChange(of: game.blastPulse) { _, _ in
            fx.blast()
        }
        .onChange(of: game.winPulse) { _, _ in
            fx.celebrate(big: game.bigWin)
        }
        .sheet(isPresented: $game.showPaytable) { PaytableSheet() }
        .sheet(isPresented: $game.showRules) { RulesSheet(refill: game.refillCredits) }
        .sheet(isPresented: $game.showSettings) { SettingsSheet(game: game) }
        .confirmationDialog(
            buyTitle,
            isPresented: buyPresented,
            titleVisibility: .visible
        ) {
            Button(buyConfirm) { game.confirmPendingBuy() }
            Button("Отмена", role: .cancel) { game.confirmBuy = nil }
        } message: {
            Text("Списание только в игровых кредитах. Деньги не участвуют.")
        }
    }

    private var buyPresented: Binding<Bool> {
        Binding(
            get: { game.confirmBuy != nil },
            set: { if !$0 { game.confirmBuy = nil } }
        )
    }

    private var buyTitle: String {
        guard let mode = game.confirmBuy else { return "Покупка режима" }
        let cost = game.bet * (mode == .hunter ? Cabinet.hunterCost : Cabinet.packCost)
        return "\(mode.title) за \(credits(cost)) кредитов?"
    }

    private var buyConfirm: String {
        "Открыть"
    }

    private func installSpacebar() {
        guard spaceMonitor == nil else { return }
        spaceMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            guard event.keyCode == 49, event.modifierFlags.intersection([.command, .control, .option]).isEmpty else {
                return event
            }
            if game.showRules || game.showPaytable || game.showSettings || game.confirmBuy != nil { return event }
            let responder = NSApp.keyWindow?.firstResponder
            if responder is NSTextView || responder is NSTextField { return event }
            game.spin()
            return nil
        }
    }

    private func removeSpacebar() {
        if let spaceMonitor {
            NSEvent.removeMonitor(spaceMonitor)
        }
        spaceMonitor = nil
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("ТОРПЕДНЫЙ ОТСЕК")
                    .font(Theme.display(28))
                    .foregroundStyle(Theme.brass)
                Text("Морской рейд · шесть барабанов · пути слева направо")
                    .font(Theme.text(12))
                    .foregroundStyle(Theme.foam.opacity(0.72))
            }
            Spacer()
            statPill(title: "Глубина", value: game.mode.depthLabel)
            statPill(title: "Пути", value: credits(game.ways))
            statPill(title: "Множитель", value: "×\(game.multiplier)")
            if game.mode != .base {
                statPill(title: game.mode.title, value: "\(game.freeSpins) \(spinsWord(game.freeSpins))")
            }
        }
    }

    private func statPill(title: String, value: String) -> some View {
        VStack(alignment: .trailing, spacing: 1) {
            Text(title.uppercased())
                .font(Theme.text(9, "AvenirNext-Bold"))
                .foregroundStyle(Theme.brass.opacity(0.8))
            Text(value)
                .font(Theme.text(14, "AvenirNext-Bold"))
                .foregroundStyle(Theme.foam)
                .monospacedDigit()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.brass.opacity(0.28), lineWidth: 1))
    }

    private var board: some View {
        GeometryReader { geo in
            let rows = CGFloat(max(game.grid.map(\.count).max() ?? 4, 1))
            let tileW = min(118, max(70, (geo.size.width - 48) / 6.5))
            let bannerSpace: CGFloat = game.banner == nil ? 0 : 44
            let chrome = bannerSpace + 28 + max(0, rows - 1) * 4
            let tileH = min(tileW * 0.92, max(52, (geo.size.height - chrome) / rows))
            let tile = CGSize(width: tileW, height: tileH)

            VStack(spacing: 8) {
                if let banner = game.banner {
                    Text(banner)
                        .font(Theme.text(15, "AvenirNext-Bold"))
                        .foregroundStyle(Color.black.opacity(0.85))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(Theme.brass, in: Capsule())
                }
                HStack(alignment: .center, spacing: 8) {
                    ForEach(0..<6, id: \.self) { reel in
                        ReelColumn(
                            cells: game.grid[safe: reel] ?? [],
                            reel: reel,
                            spinning: game.spinningReels,
                            highlighted: game.highlighted,
                            tile: tile
                        )
                    }
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Theme.hull.opacity(0.92))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [Theme.brass, Theme.brassDeep, Theme.brass.opacity(0.45)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 2
                        )
                )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxHeight: .infinity)
        .animation(.spring(duration: 0.35), value: game.mode)
        .animation(.easeOut(duration: 0.25), value: game.banner)
    }

    private var logStrip: some View {
        HStack {
            Text(game.log.last ?? "")
                .font(Theme.text(12))
                .foregroundStyle(Theme.foam.opacity(0.82))
                .lineLimit(1)
            Spacer()
            if game.autoplayLeft > 0 {
                Text("Авто \(game.autoplayLeft)")
                    .font(Theme.text(11, "AvenirNext-Bold"))
                    .foregroundStyle(Theme.brass)
            }
        }
        .padding(.horizontal, 4)
        .frame(height: 18)
    }

    private var controls: some View {
        HStack(alignment: .center, spacing: 14) {
            creditBlock(title: "Кредиты", value: credits(game.balance), emphasize: game.shakeCredits)
            creditBlock(title: "Выигрыш", value: credits(game.spinWin), emphasize: false)
            creditBlock(title: "Раунд", value: credits(game.roundWin), emphasize: false)

            betControl

            VStack(spacing: 6) {
                buyButton("Тихая охота · \(Cabinet.hunterCost)×", mode: .hunter)
                buyButton("Стая · \(Cabinet.packCost)×", mode: .pack)
            }
            .frame(width: 168)

            autoMenu

            Button(action: game.spin) {
                VStack(spacing: 2) {
                    Text(game.busy ? "СТОП" : "ПУСК")
                        .font(Theme.display(20))
                    Text(game.busy ? "ускорить" : "пробел")
                        .font(Theme.text(10, "AvenirNext-Medium"))
                        .foregroundStyle(Color.black.opacity(0.6))
                }
                .foregroundStyle(Color.black.opacity(0.85))
                .frame(width: 108, height: 72)
                .background(
                    LinearGradient(colors: [Theme.brass, Color(red: 0.72, green: 0.50, blue: 0.18)], startPoint: .top, endPoint: .bottom),
                    in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                )
                .shadow(color: Theme.brass.opacity(0.35), radius: 10, y: 4)
            }
            .buttonStyle(.plain)
            .disabled(game.balance < game.bet && game.freeSpins == 0 && !game.busy)
            .opacity(game.balance < game.bet && game.freeSpins == 0 && !game.busy ? 0.45 : 1)
        }
        .padding(12)
        .background(Color.black.opacity(0.38), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.brass.opacity(0.28), lineWidth: 1))
    }

    private func creditBlock(title: String, value: String, emphasize: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(Theme.text(10, "AvenirNext-Bold"))
                .foregroundStyle(Theme.brass.opacity(0.85))
            Text(value)
                .font(Theme.text(20, "AvenirNext-Bold"))
                .foregroundStyle(emphasize ? Theme.danger : Theme.foam)
                .monospacedDigit()
                .contentTransition(.numericText())
        }
        .frame(minWidth: 90, alignment: .leading)
    }

    private var betControl: some View {
        VStack(spacing: 4) {
            Text("СТАВКА")
                .font(Theme.text(10, "AvenirNext-Bold"))
                .foregroundStyle(Theme.brass.opacity(0.85))
            HStack(spacing: 8) {
                Button { game.stepBet(-1) } label: {
                    Image(systemName: "minus")
                        .frame(width: 28, height: 28)
                }
                Text(credits(game.bet))
                    .font(Theme.text(18, "AvenirNext-Bold"))
                    .foregroundStyle(Theme.foam)
                    .frame(minWidth: 36)
                    .monospacedDigit()
                Button { game.stepBet(1) } label: {
                    Image(systemName: "plus")
                        .frame(width: 28, height: 28)
                }
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.foam)
            .disabled(!game.canChangeBet)
            .opacity(game.canChangeBet ? 1 : 0.4)
        }
    }

    private func buyButton(_ title: String, mode: GameMode) -> some View {
        Button {
            game.requestBuy(mode)
        } label: {
            Text(title)
                .font(Theme.text(11, "AvenirNext-Bold"))
                .foregroundStyle(Theme.foam)
                .frame(maxWidth: .infinity, minHeight: 28)
                .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 7))
                .overlay(RoundedRectangle(cornerRadius: 7).stroke(Theme.brass.opacity(0.3), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(!game.canChangeBet)
        .opacity(game.canChangeBet ? 1 : 0.4)
    }

    private var autoMenu: some View {
        Menu {
            Button("10 пусков") { game.startAutoplay(10) }
            Button("25 пусков") { game.startAutoplay(25) }
            Button("50 пусков") { game.startAutoplay(50) }
            if game.autoplayLeft > 0 || game.busy {
                Button("Остановить") { game.stopAutoplay() }
            }
            Divider()
            Button("Настройки") { game.showSettings = true }
            Button("Таблица выплат") { game.showPaytable = true }
            Button("Как играть") { game.showRules = true }
        } label: {
            VStack(spacing: 2) {
                Image(systemName: "gearshape.fill")
                Text("МЕНЮ")
                    .font(Theme.text(10, "AvenirNext-Bold"))
            }
            .foregroundStyle(Theme.foam)
            .frame(width: 64, height: 72)
            .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
    }
}

private extension Array where Element == [Cell] {
    subscript(safe index: Int) -> [Cell]? {
        indices.contains(index) ? self[index] : nil
    }
}

struct PaytableSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Таблица выплат")
                    .font(Theme.display(24))
                    .foregroundStyle(Theme.brass)
                Spacer()
                Button("Закрыть") { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }
            Text("Выплата за одну путь, в долях ставки. Несколько путей складываются, затем умножаются на множитель.")
                .font(Theme.text(13))
                .foregroundStyle(Theme.foam.opacity(0.8))
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                GridRow {
                    Text("Символ")
                    Text("3")
                    Text("4")
                    Text("5")
                    Text("6")
                }
                .font(Theme.text(12, "AvenirNext-Bold"))
                .foregroundStyle(Theme.brass)
                ForEach(Symbol.paying.reversed(), id: \.self) { symbol in
                    GridRow {
                        Text(symbol.title)
                            .frame(width: 90, alignment: .leading)
                        ForEach(0..<4, id: \.self) { index in
                            Text(pay(symbol, index))
                                .frame(width: 64, alignment: .trailing)
                                .monospacedDigit()
                        }
                    }
                    .font(Theme.text(14))
                    .foregroundStyle(Theme.foam)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(24)
        .frame(minWidth: 520, minHeight: 520)
        .background(Theme.abyss)
    }

    private func pay(_ symbol: Symbol, _ index: Int) -> String {
        let hundredths = Symbol.pays[symbol]?[index] ?? 0
        return String(format: "%.2f×", Double(hundredths) / 100)
    }
}

struct RulesSheet: View {
    @Environment(\.dismiss) private var dismiss
    var refill: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Как устроен рейд")
                    .font(Theme.display(24))
                    .foregroundStyle(Theme.brass)
                Spacer()
                Button("Закрыть") { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Это демонстрация на игровые кредиты. Ставки не списывают деньги и выигрыш нельзя вывести.")
                        .font(Theme.text(14, "AvenirNext-Bold"))
                    rule("Поле", "Шесть барабанов высотой 2-3-4-4-3-2. В базовой игре 576 путей. Выигрыш — один символ на трёх и более барабанах подряд, начиная слева. Wild заменяет любой символ, кроме сонара.")
                    rule("Глубина", "На 3 и 4 барабанах может встать столбик wild высотой 4. Если он виден не целиком, барабан сдвигается, пока wild не закроет колонку. Каждый шаг добавляет к его множителю.")
                    rule("Течение", "На 2 и 5 барабанах клетка может раскрыться в 2 или 3 одинаковых символа и умножить пути. Если течений несколько, символ у них общий.")
                    rule("Мина", "Мина — это wild. После выплаты она срывает символы, которые не вошли в выигрыш, и поднимает множитель перед следующим падением. Выигрышные клетки тоже уходят, на их место падают новые.")
                    rule("Сонар", "Три сонара на барабанах 2–5 открывают «Тихую охоту»: 8 пусков, средний барабан вырастает до 8 рядов. Четыре сонара открывают «Стаю». В бонусе каждый новый сонар даёт ещё 2 пуска.")
                    rule("Перископ", "В тихой охоте перископ на среднем барабане вместе с заготовкой слева пускает торпеду. Попадание заполняет барабан wild, сдвигает его вниз и даёт ×8 к этому пуску плюс постоянный множитель. Промах оставляет одиночный wild.")
                    rule("Сборка торпеды", "В стае под барабанами 2–5 собирается одна торпеда из четырёх частей: хвост, мотор, заряд и нос. Часть, упавшая торпедным wild, кладёт заряд в свой отсек. Первый заряд отсека равен 2, следующие — по 1, потолок 9. Мина в том же пуске добавляет ещё 1. Когда заняты все четыре отсека, торпеда уходит: хвост и нос становятся стопкой символа, мотор и заряд — стопкой wild, размером с накопленный заряд. Каждый пуск поднимает множитель стаи на 1.")
                    rule("Потолок", "Раунд останавливается на золоте бездны — \(credits(Cabinet.maxMultiple))× ставки.")
                    rule("Покупка", "Тихую охоту можно открыть за \(Cabinet.hunterCost)× ставки, стаю — за \(Cabinet.packCost)×. Это те же игровые кредиты.")
                    Text("Множители глубины, мин и бонуса складываются. Если особых множителей нет, выплата идёт как ×1.")
                        .font(Theme.text(13))
                        .foregroundStyle(Theme.foam.opacity(0.85))
                }
            }
            HStack {
                Button("Пополнить кредиты до \(credits(Cabinet.startingCredits))") {
                    refill()
                    dismiss()
                }
                Spacer()
                Text("Пробел — пуск. Повторное нажатие ускоряет анимацию.")
                    .font(Theme.text(12))
                    .foregroundStyle(Theme.foam.opacity(0.6))
            }
        }
        .padding(24)
        .frame(minWidth: 640, minHeight: 560)
        .background(Theme.abyss)
        .foregroundStyle(Theme.foam)
    }

    private func rule(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(Theme.text(14, "AvenirNext-Bold"))
                .foregroundStyle(Theme.brass)
            Text(body)
                .font(Theme.text(13))
                .foregroundStyle(Theme.foam.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
