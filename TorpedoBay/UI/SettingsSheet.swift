import SwiftUI

struct SettingsSheet: View {
    @Bindable var game: GameStore
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Настройки")
                    .font(Theme.display(24))
                    .foregroundStyle(Theme.brass)
                Spacer()
                Button("Закрыть") { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }

            Text("Музыка отсека, звуки пуска и портреты экипажа. Чит-код ниже пополняет только игровые кредиты.")
                .font(Theme.text(13))
                .foregroundStyle(Theme.foam.opacity(0.8))
                .fixedSize(horizontal: false, vertical: true)

            Toggle("Музыка отсека", isOn: Binding(
                get: { game.musicOn },
                set: { game.setMusic($0) }
            ))
            Toggle("Звуки пусков", isOn: Binding(
                get: { game.effectsOn },
                set: { game.setEffects($0) }
            ))
            .toggleStyle(.switch)

            Divider().overlay(Theme.brass.opacity(0.3))

            Text("ЧИТ-КОД")
                .font(Theme.text(11, "AvenirNext-Bold"))
                .foregroundStyle(Theme.brass)
            Text("Пополняет только игровые кредиты.")
                .font(Theme.text(12))
                .foregroundStyle(Theme.foam.opacity(0.7))

            HStack {
                TextField("Код", text: $code)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(apply)
                Button("Применить", action: apply)
                    .keyboardShortcut(.defaultAction)
            }

            if !game.cheatNote.isEmpty {
                Text(game.cheatNote)
                    .font(Theme.text(14, "AvenirNext-Bold"))
                    .foregroundStyle(game.cheatNote == "Код не принят" ? Theme.danger : Theme.signal)
            }

            Text("Сейчас в трюме \(credits(game.balance))")
                .font(Theme.text(13))
                .foregroundStyle(Theme.foam)
                .monospacedDigit()

            Spacer(minLength: 0)
        }
        .padding(24)
        .frame(minWidth: 460, minHeight: 380)
        .background(Theme.abyss)
        .foregroundStyle(Theme.foam)
    }

    private func apply() {
        game.applyCheat(code)
        if game.cheatNote != "Код не принят" {
            code = ""
        }
    }
}
