import SwiftUI
import UIKit

/// Transparent UIKit overlay that detects horizontal swipes alongside UIScrollView.
/// SwiftUI's DragGesture can't reliably coexist with UIScrollView — this uses
/// UIPanGestureRecognizer + shouldRecognizeSimultaneously to solve that.
struct SwipeGestureOverlay: UIViewRepresentable {
    var onSwipeLeft: (() -> Void)?
    var onSwipeRight: (() -> Void)?

    func makeUIView(context: Context) -> UIView {
        let view = PassthroughView()
        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handle(_:)))
        pan.delegate = context.coordinator
        view.addGestureRecognizer(pan)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.onSwipeLeft = onSwipeLeft
        context.coordinator.onSwipeRight = onSwipeRight
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onSwipeLeft: (() -> Void)?
        var onSwipeRight: (() -> Void)?

        @objc func handle(_ gr: UIPanGestureRecognizer) {
            guard gr.state == .ended else { return }
            let t = gr.translation(in: gr.view)
            // Must be clearly horizontal (2× horizontal vs vertical) and at least 50pt
            guard abs(t.x) > abs(t.y) * 2, abs(t.x) > 50 else { return }
            if t.x < 0 { onSwipeLeft?() } else { onSwipeRight?() }
        }

        // Key: allow simultaneous recognition with UIScrollView's pan
        func gestureRecognizer(_ gr: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
            return true
        }
    }
}

// Passes all touches through to subviews so UI remains interactive
private final class PassthroughView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit == self ? nil : hit
    }
}
