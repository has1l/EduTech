import SwiftUI
import WebKit

/// Renders text with LaTeX math (\(...\) and \[...\]) via bundled KaTeX (no CDN).
/// Falls back to plain Text if no math markers detected.
struct MathText: View {
    let text: String
    var fontSize: CGFloat = 17

    @State private var webHeight: CGFloat = 60

    private var hasMath: Bool {
        text.contains("\\(") || text.contains("\\[")
    }

    var body: some View {
        if hasMath {
            _MathWebView(text: text, fontSize: fontSize, height: $webHeight)
                .frame(height: webHeight)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Text(text)
                .font(.system(size: fontSize, design: .serif))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct _MathWebView: UIViewRepresentable {
    let text: String
    let fontSize: CGFloat
    @Binding var height: CGFloat

    func makeCoordinator() -> Coordinator { Coordinator(height: $height) }

    // Points to the bundled KaTeX folder so scripts/fonts load from disk, no network needed
    private static let katexBase: URL = {
        Bundle.main.url(forResource: "katex.min", withExtension: "js")?
            .deletingLastPathComponent() ?? Bundle.main.bundleURL
    }()

    func makeUIView(context: Context) -> WKWebView {
        let wv = WKWebView()
        wv.navigationDelegate = context.coordinator
        wv.isOpaque = false
        wv.backgroundColor = .clear
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.bounces = false
        context.coordinator.lastText = text
        wv.loadHTMLString(html(text), baseURL: Self.katexBase)
        return wv
    }

    func updateUIView(_ wv: WKWebView, context: Context) {
        guard context.coordinator.lastText != text else { return }
        context.coordinator.lastText = text
        wv.loadHTMLString(html(text), baseURL: Self.katexBase)
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.stopLoading()
        uiView.navigationDelegate = nil
    }

    private func html(_ raw: String) -> String {
        let body = raw
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\n", with: "<br>")
        return """
        <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
        <link rel="stylesheet" href="katex.min.css">
        <script defer src="katex.min.js"></script>
        <script defer src="auto-render.min.js"
            onload="renderMathInElement(document.body,{delimiters:[{left:'\\\\(',right:'\\\\)',display:false},{left:'\\\\[',right:'\\\\]',display:true}],throwOnError:false})"></script>
        <style>
        *{box-sizing:border-box}
        body{margin:0;padding:2px 0;font-family:-apple-system,Georgia,serif;font-size:\(Int(fontSize))px;line-height:1.5;word-wrap:break-word;background:transparent}
        @media(prefers-color-scheme:dark){body{color:#f5f5f5}}
        @media(prefers-color-scheme:light){body{color:#111}}
        .katex{font-size:1.05em}
        </style>
        </head><body>\(body)</body></html>
        """
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var height: CGFloat
        var lastText: String = ""

        init(height: Binding<CGFloat>) { _height = height }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Measure twice: initial layout + after KaTeX scripts finish rendering
            measure(webView, after: 0.1)
            measure(webView, after: 0.8)
        }

        private func measure(_ wv: WKWebView, after delay: TimeInterval) {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self, weak wv] in
                wv?.evaluateJavaScript("document.body.scrollHeight") { result, _ in
                    let h: CGFloat
                    if let d = result as? Double { h = CGFloat(d) }
                    else if let i = result as? Int { h = CGFloat(i) }
                    else { return }
                    if h > 10 { self?.height = h + 4 }
                }
            }
        }
    }
}
