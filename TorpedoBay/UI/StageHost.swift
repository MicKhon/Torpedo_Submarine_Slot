import AppKit
import Darwin
import SwiftUI
import WebKit

struct StageHost: NSViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> StageBox {
        let box = StageBox()
        box.webView.navigationDelegate = context.coordinator
        box.onReady = { webView in
            context.coordinator.load(webView)
        }
        return box
    }

    func updateNSView(_ box: StageBox, context: Context) {
        context.coordinator.load(box.webView)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let server = BayServer(root: Bundle.main.resourceURL)
        private var started = false

        func load(_ webView: WKWebView) {
            guard !started, webView.window != nil, let server else { return }
            started = true
            let url = URL(string: "http://127.0.0.1:\(server.port)/index.html")!
            webView.load(URLRequest(url: url))
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.alphaValue = 1
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let message = error.localizedDescription
            webView.alphaValue = 1
            webView.loadHTMLString("<body style='margin:0;background:#14181c;color:#e7c98a;font:22px sans-serif;padding:36px'>\(message)</body>", baseURL: nil)
        }
    }
}

final class StageBox: NSView {
    let webView: WKWebView
    var onReady: ((WKWebView) -> Void)?

    override init(frame frameRect: NSRect) {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: frameRect, configuration: configuration)
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor(red: 0.05, green: 0.06, blue: 0.07, alpha: 1).cgColor
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.alphaValue = 0
        webView.underPageBackgroundColor = NSColor(red: 0.02, green: 0.027, blue: 0.04, alpha: 1)
        addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: trailingAnchor),
            webView.topAnchor.constraint(equalTo: topAnchor),
            webView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        let title = NSTextField(labelWithString: "TORPEDO X STRIKE")
        title.font = NSFont(name: "Copperplate", size: 42) ?? .boldSystemFont(ofSize: 42)
        title.textColor = NSColor(red: 0.78, green: 0.63, blue: 0.35, alpha: 1)
        title.translatesAutoresizingMaskIntoConstraints = false
        addSubview(title, positioned: .below, relativeTo: webView)
        NSLayoutConstraint.activate([
            title.centerXAnchor.constraint(equalTo: centerXAnchor),
            title.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window != nil { onReady?(webView) }
    }
}

final class BayServer {
    let port: Int
    private let listenFD: Int32
    private let root: URL
    private let queue = DispatchQueue(label: "bay.http")
    private var source: DispatchSourceRead?

    init?(root: URL?) {
        guard let root else { return nil }
        self.root = root
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        listenFD = fd
        guard fd >= 0 else { return nil }
        var yes: Int32 = 1
        setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))
        var addr = sockaddr_in()
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = 0
        addr.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
        let bound = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0, Darwin.listen(fd, 16) == 0 else {
            close(fd)
            return nil
        }
        var actual = sockaddr_in()
        var length = socklen_t(MemoryLayout<sockaddr_in>.size)
        _ = withUnsafeMutablePointer(to: &actual) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                getsockname(fd, $0, &length)
            }
        }
        port = Int(UInt16(bigEndian: actual.sin_port))
        let source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: queue)
        source.setCancelHandler { close(fd) }
        self.source = source
        source.setEventHandler { [weak self] in self?.acceptClient() }
        source.resume()
    }

    private func acceptClient() {
        var addr = sockaddr_in()
        var length = socklen_t(MemoryLayout<sockaddr_in>.size)
        let client = withUnsafeMutablePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                accept(listenFD, $0, &length)
            }
        }
        guard client >= 0 else { return }
        queue.async { self.serve(client) }
    }

    private func serve(_ client: Int32) {
        defer { close(client) }
        var buffer = [UInt8](repeating: 0, count: 4096)
        let count = read(client, &buffer, buffer.count)
        guard count > 0 else { return }
        let request = String(bytes: buffer.prefix(count), encoding: .utf8) ?? ""
        let rawPath = request.split(separator: " ").dropFirst().first.map(String.init) ?? "/"
        var name = (rawPath as NSString).lastPathComponent
        if name.isEmpty || name == "/" { name = "index.html" }
        let file = root.appendingPathComponent(name)
        let data = (try? Data(contentsOf: file)) ?? Data()
        let mime: String
        switch (name as NSString).pathExtension {
        case "html": mime = "text/html; charset=utf-8"
        case "js": mime = "text/javascript; charset=utf-8"
        case "jpg", "jpeg": mime = "image/jpeg"
        case "png": mime = "image/png"
        case "wav": mime = "audio/wav"
        default: mime = "application/octet-stream"
        }
        let status = data.isEmpty ? "404 Not Found" : "200 OK"
        let header = "HTTP/1.1 \(status)\r\nContent-Type: \(mime)\r\nContent-Length: \(data.count)\r\nConnection: close\r\n\r\n"
        var response = Data(header.utf8)
        if !data.isEmpty { response.append(data) }
        response.withUnsafeBytes { raw in
            guard let base = raw.baseAddress else { return }
            var sent = 0
            while sent < raw.count {
                let wrote = Darwin.write(client, base.advanced(by: sent), raw.count - sent)
                if wrote <= 0 { break }
                sent += wrote
            }
        }
    }
}
