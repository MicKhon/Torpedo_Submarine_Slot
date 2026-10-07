import AppKit

enum Portraits {
    private static let names: [Symbol: String] = [
        .captain: "captain",
        .officer: "officer",
        .engineer: "engineer",
        .radio: "radio",
        .cook: "cook"
    ]

    private static let cache: [Symbol: NSImage] = {
        var found: [Symbol: NSImage] = [:]
        for (symbol, name) in names {
            let url = Bundle.main.url(forResource: name, withExtension: "jpg")
                ?? Bundle.main.url(forResource: name, withExtension: "jpg", subdirectory: "Art")
            if let url, let image = NSImage(contentsOf: url) {
                found[symbol] = image
            }
        }
        return found
    }()

    static func image(for symbol: Symbol) -> NSImage? {
        cache[symbol]
    }
}
