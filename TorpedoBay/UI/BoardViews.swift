import SwiftUI

struct OceanBackground: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                for index in 0..<18 {
                    let width = max(size.width, 1)
                    let height = max(size.height, 1)
                    let x = CGFloat((index * 137) % Int(width))
                    let speed = 22.0 + Double(index % 5) * 9.0
                    let travel = CGFloat((t * speed + Double(index * 90)).truncatingRemainder(dividingBy: Double(height + 30)))
                    let y = height - travel
                    let radius = CGFloat(2 + index % 4)
                    let rect = CGRect(x: x, y: y, width: radius, height: radius)
                    context.fill(Path(ellipseIn: rect), with: .color(.white.opacity(0.14)))
                }
            }
        }
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.02, green: 0.08, blue: 0.12),
                    Color(red: 0.03, green: 0.16, blue: 0.22),
                    Color(red: 0.02, green: 0.07, blue: 0.10)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .ignoresSafeArea()
    }
}

struct SymbolTile: View {
    var cell: Cell
    var highlight: Bool
    var width: CGFloat
    var height: CGFloat
    var showDepth: Bool

    var body: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.symbolFill(cell.symbol))
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(highlight ? Theme.brass : Color.white.opacity(0.14), lineWidth: highlight ? 2 : 1)
            if let portrait = Portraits.image(for: cell.symbol) {
                Image(nsImage: portrait)
                    .resizable()
                    .scaledToFill()
                    .frame(width: width, height: height)
                    .clipped()
                LinearGradient(
                    colors: [.clear, .black.opacity(0.15), .black.opacity(0.82)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                Text(cell.symbol.title)
                    .font(Theme.text(max(9, width * 0.13), "AvenirNext-Bold"))
                    .foregroundStyle(Theme.foam)
                    .shadow(color: .black.opacity(0.8), radius: 2, y: 1)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 4)
                    .padding(.horizontal, 3)
            } else {
                VStack(spacing: 1) {
                    icon
                        .frame(height: showsCaption ? height * 0.46 : height * 0.62)
                    if showsCaption {
                        Text(cell.symbol.title)
                            .font(Theme.text(max(9, width * 0.13), "AvenirNext-Bold"))
                            .foregroundStyle(Theme.foam)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                }
                .padding(.horizontal, 3)
            }

            if cell.ways > 1 {
                badge("×\(cell.ways)", fill: Theme.brass, ink: Color.black.opacity(0.8))
            } else if showDepth && cell.depthMultiplier > 1 {
                badge("×\(cell.depthMultiplier)", fill: Theme.lagoon, ink: Theme.foam)
            }
        }
        .frame(width: width, height: height)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .opacity(cell.ways == 0 ? 0.72 : 1)
        .scaleEffect(highlight ? 1.04 : 1)
        .shadow(color: highlight ? Theme.brass.opacity(0.55) : .black.opacity(0.25), radius: highlight ? 8 : 3, y: 2)
    }

    private var icon: some View {
        Group {
            switch cell.symbol {
            case .torpedo:
                TorpedoGlyph()
                    .stroke(Theme.foam, style: StrokeStyle(lineWidth: 1.4, lineJoin: .round))
            case .periscope:
                Image(systemName: "scope")
            case .depth:
                Image(systemName: "arrow.up.and.down")
            case .mine:
                Image(systemName: "burst.fill")
            case .sonar:
                Image(systemName: "wave.3.right.circle.fill")
            case .captain:
                Image(systemName: "helm")
            case .officer:
                Image(systemName: "star.fill")
            case .engineer:
                Image(systemName: "wrench.and.screwdriver.fill")
            case .radio:
                Image(systemName: "antenna.radiowaves.left.and.right")
            case .cook:
                Image(systemName: "fork.knife")
            default:
                Text(cell.symbol.title)
                    .font(Theme.text(height * 0.34, "AvenirNext-Bold"))
                    .foregroundStyle(Theme.brass)
            }
        }
        .font(.system(size: height * 0.28, weight: .semibold))
        .foregroundStyle(iconColor)
    }

    private var showsCaption: Bool {
        switch cell.symbol {
        case .ten, .jack, .queen, .king, .ace: false
        default: true
        }
    }

    private var iconColor: Color {
        switch cell.symbol {
        case .captain, .ten, .jack, .queen, .king, .ace: Theme.brass
        case .mine: Color(red: 1, green: 0.62, blue: 0.35)
        case .sonar, .periscope: Theme.signal
        default: Theme.foam
        }
    }

    private func badge(_ text: String, fill: Color, ink: Color) -> some View {
        Text(text)
            .font(Theme.text(9, "AvenirNext-Bold"))
            .foregroundStyle(ink)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .background(fill, in: Capsule())
            .padding(3)
    }
}

struct TorpedoGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let body = CGRect(x: rect.minX + rect.width * 0.18, y: rect.midY - rect.height * 0.16,
                          width: rect.width * 0.62, height: rect.height * 0.32)
        path.addRoundedRect(in: body, cornerSize: CGSize(width: 4, height: 4))
        path.move(to: CGPoint(x: body.maxX, y: body.minY))
        path.addLine(to: CGPoint(x: rect.maxX - 2, y: rect.midY))
        path.addLine(to: CGPoint(x: body.maxX, y: body.maxY))
        path.move(to: CGPoint(x: body.minX + 4, y: body.minY))
        path.addLine(to: CGPoint(x: body.minX - rect.width * 0.08, y: rect.minY + 2))
        path.move(to: CGPoint(x: body.minX + 4, y: body.maxY))
        path.addLine(to: CGPoint(x: body.minX - rect.width * 0.08, y: rect.maxY - 2))
        return path
    }
}

struct ReelColumn: View {
    var cells: [Cell]
    var reel: Int
    var spinning: Bool
    var highlighted: Set<SlotPos>
    var tile: CGSize

    var body: some View {
        ZStack {
            if spinning {
                ScrollingColumn(rows: max(cells.count, 2), tile: tile)
            } else {
                VStack(spacing: 4) {
                    ForEach(Array(cells.enumerated()), id: \.element.id) { row, cell in
                        SymbolTile(
                            cell: cell,
                            highlight: highlighted.contains(SlotPos(reel: reel, row: row)),
                            width: tile.width,
                            height: tile.height,
                            showDepth: row == 0 || cell.depthMultiplier > 1 && cells[..<row].allSatisfy { $0.depthMultiplier == 0 }
                        )
                    }
                }
                .transition(.opacity)
            }
        }
        .frame(width: tile.width, height: columnHeight, alignment: .center)
    }

    private var columnHeight: CGFloat {
        let rows = CGFloat(max(cells.count, 1))
        return rows * tile.height + max(0, rows - 1) * 4
    }
}

struct ScrollingColumn: View {
    var rows: Int
    var tile: CGSize

    var body: some View {
        let strip = Symbol.paying + Symbol.paying
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            let cycle = tile.height + 4
            let distance = CGFloat(timeline.date.timeIntervalSinceReferenceDate * 920)
            let shift = distance.truncatingRemainder(dividingBy: cycle * CGFloat(Symbol.paying.count))
            VStack(spacing: 4) {
                ForEach(0..<strip.count, id: \.self) { index in
                    SymbolTile(
                        cell: Cell(symbol: strip[index]),
                        highlight: false,
                        width: tile.width,
                        height: tile.height,
                        showDepth: false
                    )
                }
            }
            .offset(y: -shift)
        }
        .frame(width: tile.width, height: CGFloat(rows) * tile.height + CGFloat(max(0, rows - 1)) * 4)
        .clipped()
        .blur(radius: 0.4)
    }
}

struct TorpedoAssembly: View {
    var tubes: [TorpedoTube]
    var armed: Bool
    var launching: Bool
    var active: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("ТОРПЕДНЫЙ ОТСЕК")
                    .font(Theme.display(13))
                    .foregroundStyle(Theme.brass)
                Spacer()
                Text(active ? (armed ? "К ПУСКУ" : "СБОРКА") : "ЗАПЕРТ ДО «СТАИ»")
                    .font(Theme.text(11, "AvenirNext-Bold"))
                    .foregroundStyle(armed ? Theme.danger : Theme.foam.opacity(0.7))
            }
            HStack(spacing: 8) {
                ForEach(0..<4, id: \.self) { index in
                    TorpedoSegment(
                        name: TorpedoTube.names[index],
                        role: TorpedoTube.roles[index],
                        charge: tubes[safe: index]?.charge ?? 0,
                        active: active,
                        launching: launching
                    )
                }
            }
            TorpedoSilhouette(charges: tubes.map(\.charge), launching: launching, active: active)
                .frame(height: 28)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.black.opacity(active ? 0.35 : 0.22))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(armed ? Theme.danger.opacity(0.8) : Theme.brass.opacity(0.35), lineWidth: 1)
        )
        .opacity(active ? 1 : 0.72)
    }
}

private extension Array where Element == TorpedoTube {
    subscript(safe index: Int) -> TorpedoTube? {
        indices.contains(index) ? self[index] : nil
    }
}

struct TorpedoSegment: View {
    var name: String
    var role: String
    var charge: Int
    var active: Bool
    var launching: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(name)
                    .font(Theme.text(12, "AvenirNext-Bold"))
                Spacer()
                Text(role)
                    .font(Theme.text(10, "AvenirNext-Medium"))
                    .foregroundStyle(Theme.brass.opacity(0.85))
            }
            .foregroundStyle(Theme.foam)
            HStack(spacing: 3) {
                ForEach(1...9, id: \.self) { pip in
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(pip <= charge ? Theme.brass : Color.white.opacity(0.08))
                        .frame(height: 8)
                }
            }
            Text(charge == 0 ? "пусто" : "заряд \(charge)")
                .font(Theme.text(10))
                .foregroundStyle(charge == 0 ? Theme.foam.opacity(0.45) : Theme.brass)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(active && charge > 0 ? 0.06 : 0.03), in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            if launching && charge == 0 && active {
                RoundedRectangle(cornerRadius: 8).stroke(Theme.danger.opacity(0.9), lineWidth: 1)
            }
        }
    }
}

struct TorpedoSilhouette: View {
    var charges: [Int]
    var launching: Bool
    var active: Bool

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.white.opacity(0.05))
                HStack(spacing: 2) {
                    ForEach(0..<4, id: \.self) { index in
                        Capsule()
                            .fill(segmentColor(index))
                    }
                }
                .padding(3)
                Image(systemName: "location.north.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.danger)
                    .rotationEffect(.degrees(90))
                    .offset(x: launching ? width - 28 : noseOffset(width))
                    .opacity(active ? 1 : 0.25)
                    .animation(.easeIn(duration: 0.8), value: launching)
            }
        }
    }

    private func segmentColor(_ index: Int) -> Color {
        let charge = index < charges.count ? charges[index] : 0
        if charge == 0 { return Color.white.opacity(0.06) }
        return Theme.brass.opacity(0.35 + 0.07 * Double(charge))
    }

    private func noseOffset(_ width: CGFloat) -> CGFloat {
        let filled = charges.filter { $0 > 0 }.count
        return width * CGFloat(filled) / 5.0
    }
}

struct ScopeOverlay: View {
    var phase: ScopePhase

    var body: some View {
        ZStack {
            Color.black.opacity(0.45).ignoresSafeArea()
            VStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color(red: 0.12, green: 0.28, blue: 0.16), Color(red: 0.02, green: 0.08, blue: 0.05)],
                                center: .center,
                                startRadius: 10,
                                endRadius: 160
                            )
                        )
                    Circle().stroke(Theme.brass, lineWidth: 8)
                    Circle().stroke(Color.black.opacity(0.6), lineWidth: 18).padding(-6)
                    crosshair
                    target
                }
                .frame(width: 230, height: 230)
                Text(caption)
                    .font(Theme.display(22))
                    .foregroundStyle(phase == .hit ? Theme.brass : Theme.foam)
                Text(detail)
                    .font(Theme.text(13))
                    .foregroundStyle(Theme.foam.opacity(0.8))
            }
            .padding(24)
        }
        .transition(.opacity)
    }

    private var caption: String {
        switch phase {
        case .aiming: "ПЕРИСКОП"
        case .hit: "ПОПАДАНИЕ"
        case .miss: "ПРОМАХ"
        }
    }

    private var detail: String {
        switch phase {
        case .aiming: "Торпеда выходит из аппарата"
        case .hit: "Барабан заполнен wild и сдвигается вниз"
        case .miss: "Цель ушла. Wild остаётся на одной клетке"
        }
    }

    private var crosshair: some View {
        ZStack {
            Rectangle().fill(Theme.periscope.opacity(0.8)).frame(width: 1, height: 180)
            Rectangle().fill(Theme.periscope.opacity(0.8)).frame(width: 180, height: 1)
            Circle().stroke(Theme.periscope.opacity(0.9), lineWidth: 1).frame(width: 54, height: 54)
        }
    }

    private var target: some View {
        RoundedRectangle(cornerRadius: 3)
            .stroke(phase == .miss ? Color.white.opacity(0.3) : Theme.danger, lineWidth: 2)
            .frame(width: phase == .hit ? 36 : 70, height: 16)
            .offset(x: phase == .miss ? 48 : 0, y: phase == .aiming ? 8 : 0)
            .animation(.easeInOut(duration: 0.4), value: phase)
    }
}
