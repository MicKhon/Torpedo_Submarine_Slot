import AppKit
import SwiftUI

@main
struct TorpedoBayApp: App {
    @NSApplicationDelegateAdaptor(BayDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup {
            StageHost()
                .frame(minWidth: 1100, minHeight: 700)
                .preferredColorScheme(.dark)
        }
        .defaultSize(width: 1440, height: 860)
        .commands {
            CommandGroup(replacing: .appSettings) { }
        }
    }
}

final class BayDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        show()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: show)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2, execute: show)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        show()
        return true
    }

    private func show() {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        for window in NSApp.windows where window.canBecomeKey {
            window.collectionBehavior.insert(.moveToActiveSpace)
            window.setFrame(NSRect(x: 40, y: 80, width: 1280, height: 800), display: true)
            window.makeKeyAndOrderFront(nil)
        }
    }
}
