import SwiftUI

@MainActor
@Observable
final class DialogueVM {
    let dialogueId: UUID
    var messages: [DialogueMessage] = []
    var streamingText: String = ""
    var isStreaming: Bool = false
    var error: String?

    private var streamTask: Task<Void, Never>?

    init(dialogueId: UUID) {
        self.dialogueId = dialogueId
    }

    func start() async {
        await loadExisting()
        if messages.last?.role != "assistant" || messages.isEmpty {
            startStream()
        }
    }

    private func loadExisting() async {
        struct DialogueDTO: Decodable {
            let id: UUID
            let messages: [DialogueMessage]
            let hintLevel: Int
            let resolved: Bool
        }
        do {
            let d: DialogueDTO = try await APIClient.shared.request(.dialogue(dialogueId))
            self.messages = d.messages
        } catch {
            // first message — no dialogue yet; that's fine
        }
    }

    func sendReply(_ text: String) async {
        guard !isStreaming else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        messages.append(DialogueMessage(role: "user", content: trimmed, theoryRef: nil))
        do {
            try await APIClient.shared.requestVoid(.dialogueReply(dialogueId, text: trimmed))
            startStream()
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription
        }
    }

    private func startStream() {
        streamTask?.cancel()
        isStreaming = true
        streamingText = ""

        streamTask = Task { [weak self] in
            guard let self else { return }
            let stream = SSEClient.shared.stream(dialogueId: self.dialogueId)
            var buffer = ""
            var lastFlush = Date()
            var theory: TheoryRef?
            do {
                for try await event in stream {
                    if Task.isCancelled { break }
                    switch event {
                    case .delta(let s):
                        buffer += s
                        let now = Date()
                        if now.timeIntervalSince(lastFlush) > 0.05 {
                            await MainActor.run { self.streamingText = buffer }
                            lastFlush = now
                        }
                    case .theory(let title, let sectionId):
                        theory = TheoryRef(title: title, sectionId: sectionId)
                    case .done:
                        await MainActor.run {
                            self.streamingText = buffer
                            if !buffer.isEmpty {
                                self.messages.append(DialogueMessage(role: "assistant", content: buffer, theoryRef: theory))
                            }
                            self.streamingText = ""
                            self.isStreaming = false
                        }
                        return
                    case .error(let msg):
                        await MainActor.run {
                            self.error = msg
                            self.isStreaming = false
                        }
                        return
                    }
                }
                await MainActor.run {
                    if !buffer.isEmpty {
                        self.messages.append(DialogueMessage(role: "assistant", content: buffer, theoryRef: theory))
                    }
                    self.streamingText = ""
                    self.isStreaming = false
                }
            } catch {
                await MainActor.run {
                    self.error = (error as? LocalizedError)?.errorDescription
                    self.isStreaming = false
                }
            }
        }
    }

    func stop() {
        streamTask?.cancel()
        isStreaming = false
    }
}

private let quickReplies = ["не помню", "не понимаю", "объясни иначе", "покажи пример"]

struct DialogueView: View {
    @State var vm: DialogueVM
    @State private var reply: String = ""
    @FocusState private var inputFocused: Bool
    var showHeader: Bool = true

    init(dialogueId: UUID, showHeader: Bool = true) {
        _vm = State(initialValue: DialogueVM(dialogueId: dialogueId))
        self.showHeader = showHeader
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if showHeader { header }
                        ForEach(Array(vm.messages.enumerated()), id: \.offset) { idx, msg in
                            messageBubble(msg, isStreaming: false)
                                .id("msg-\(idx)")
                        }
                        if vm.isStreaming {
                            messageBubble(DialogueMessage(role: "assistant", content: vm.streamingText, theoryRef: nil), isStreaming: true)
                                .id("streaming")
                        }
                        if let err = vm.error {
                            Text(err).foregroundStyle(Color.appDanger).font(.caption)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
                }
                .onChange(of: vm.streamingText) { _, _ in
                    withAnimation(.smooth) { proxy.scrollTo("streaming", anchor: .bottom) }
                }
                .onChange(of: vm.messages.count) { _, _ in
                    withAnimation(.smooth) { proxy.scrollTo("msg-\(vm.messages.count - 1)", anchor: .bottom) }
                }
            }

            inputBar
        }
        .background(Color.appBg)
        .task { await vm.start() }
        .onDisappear { vm.stop() }
    }

    private var header: some View {
        HStack(spacing: 12) {
            MascotView(kind: .idle, size: 44)
                .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 0) {
                Text("AI-репетитор").font(.subheadline.bold())
                Text("Помогу разобраться, не назову ответ").font(.caption2).foregroundStyle(Color.appMuted)
            }
            Spacer()
        }
        .padding(.vertical, 12)
    }

    private func messageBubble(_ message: DialogueMessage, isStreaming: Bool) -> some View {
        let isUser = message.role == "user"
        let content = message.content.isEmpty && isStreaming ? "…" : message.content
        return HStack(alignment: .top, spacing: 10) {
            if !isUser {
                MascotView(kind: isStreaming ? .thinking : .investigating, size: 36)
                    .frame(width: 36, height: 36)
            } else {
                Spacer(minLength: 36)
            }
            bubbleContent(content: content, isUser: isUser, isStreaming: isStreaming)
            if !isUser { Spacer(minLength: 0) }
        }
    }

    @ViewBuilder
    private func bubbleContent(content: String, isUser: Bool, isStreaming: Bool) -> some View {
        if isUser {
            Text(content)
                .font(.body)
                .foregroundStyle(Color.appAccentFg)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.appAccent)
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .frame(maxWidth: .infinity, alignment: .trailing)
        } else if isStreaming {
            Text(content)
                .font(.body)
                .foregroundStyle(Color.appFg)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.appBg)
                .overlay { RoundedRectangle(cornerRadius: 18).strokeBorder(Color.appBorder, lineWidth: 1) }
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            MathText(text: content, fontSize: 17)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.appBg)
                .overlay { RoundedRectangle(cornerRadius: 18).strokeBorder(Color.appBorder, lineWidth: 1) }
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var inputBar: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Color.appBorder).frame(height: 0.5)
            if !vm.isStreaming && reply.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(quickReplies, id: \.self) { chip in
                            Button {
                                reply = chip
                                inputFocused = true
                            } label: {
                                Text(chip)
                                    .font(.subheadline)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(Color.appBorder.opacity(0.45))
                                    .foregroundStyle(Color.appFg)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
            }
            HStack(spacing: 8) {
                TextField("Ответь репетитору…", text: $reply, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.appBg)
                    .overlay { RoundedRectangle(cornerRadius: 22).strokeBorder(Color.appBorder, lineWidth: 1) }
                    .clipShape(RoundedRectangle(cornerRadius: 22))
                    .focused($inputFocused)
                    .disabled(vm.isStreaming)
                Button {
                    let text = reply
                    reply = ""
                    inputFocused = false
                    Task { await vm.sendReply(text) }
                } label: {
                    Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
                        .foregroundStyle(Color.appAccent)
                }
                .disabled(reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || vm.isStreaming)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background {
            Rectangle()
                .fill(.regularMaterial)
                .ignoresSafeArea(edges: .bottom)
        }
    }
}
