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
                guard let data = Data(base64Encoded: base64) else { return nil as UIImage? }
                return UIImage(data: data)
            }.value
            self.image = img
        } else {
            let proxied = Endpoint.imageProxy(url: urlString)
            do {
                let (data, _) = try await URLSession.shared.data(from: proxied)
                self.image = UIImage(data: data)
            } catch {
                self.image = nil
            }
        }
    }
}
