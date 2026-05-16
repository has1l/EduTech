import SwiftUI
import AVFoundation
import AVKit

enum MascotKind: String, Hashable {
    case idle
    case thinking
    case investigating

    var url: URL? {
        Bundle.main.url(forResource: rawValue, withExtension: "mp4")
    }
}

struct MascotView: View {
    let kind: MascotKind
    var size: CGFloat = 80

    var body: some View {
        MascotPlayer(kind: kind)
            .frame(width: size, height: size)
            .background(Color.white)
            .clipShape(Circle())
            .accessibilityHidden(true)
    }
}

private struct MascotPlayer: UIViewRepresentable {
    let kind: MascotKind

    func makeUIView(context: Context) -> PlayerContainer {
        let view = PlayerContainer()
        context.coordinator.attach(view: view, kind: kind)
        return view
    }

    func updateUIView(_ uiView: PlayerContainer, context: Context) {
        context.coordinator.switch(to: kind)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    static func dismantleUIView(_ uiView: PlayerContainer, coordinator: Coordinator) {
        coordinator.stop()
    }

    @MainActor
    final class Coordinator {
        private var player: AVQueuePlayer?
        private var looper: AVPlayerLooper?
        private var currentKind: MascotKind?
        private weak var view: PlayerContainer?

        func attach(view: PlayerContainer, kind: MascotKind) {
            let player = AVQueuePlayer()
            player.isMuted = true
            player.preventsDisplaySleepDuringVideoPlayback = false
            view.playerLayer.player = player
            view.playerLayer.videoGravity = .resizeAspect
            self.player = player
            self.view = view
            self.switch(to: kind)
        }

        func `switch`(to kind: MascotKind) {
            guard currentKind != kind, let player else { return }
            currentKind = kind
            guard let url = kind.url else { return }
            player.removeAllItems()
            let item = AVPlayerItem(url: url)
            looper = AVPlayerLooper(player: player, templateItem: item)
            player.play()
        }

        func stop() {
            player?.pause()
            player?.removeAllItems()
            looper = nil
            player = nil
        }
    }

    final class PlayerContainer: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        override init(frame: CGRect) {
            super.init(frame: frame)
            backgroundColor = .clear
            isOpaque = false
        }
        required init?(coder: NSCoder) { fatalError() }
    }
}
