import SwiftUI
import UIKit

struct TaskImage: View {
    let urlString: String
    var maxHeight: CGFloat = 240

    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: maxHeight)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.appBorder.opacity(0.3))
                    .frame(height: 120)
                    .overlay { ProgressView() }
            }
        }
        .task(id: urlString) { await load() }
    }

    private func load() async {
        if urlString.hasPrefix("data:") {
            guard let comma = urlString.firstIndex(of: ",") else { return }
            let base64 = String(urlString[urlString.index(after: comma)...])
            let img = await Task.detached(priority: .userInitiated) {
                guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else { return nil as UIImage? }
                return UIImage(data: data)
            }.value
            self.image = img
        } else {
            do {
                let data = try await APIClient.shared.rawRequest(.imageProxy(url: urlString))
                self.image = UIImage(data: data)
            } catch {
                self.image = nil
            }
        }
    }
}
