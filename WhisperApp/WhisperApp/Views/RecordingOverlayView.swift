// Copyright (c) 2026 Roman Barinov. MIT License.

import SwiftUI

// MARK: - Overlay states

enum OverlayState: Equatable {
    case hidden
    case recording
    case transcribing
    case done(String)
    case error(String)
}

// MARK: - Observable state for the overlay (avoids replacing rootView)

class OverlayViewModel: ObservableObject {
    static let shared = OverlayViewModel()
    @Published var state: OverlayState = .hidden
}

// MARK: - Overlay SwiftUI View

struct RecordingOverlayView: View {
    @ObservedObject var model = OverlayViewModel.shared

    @State private var pulseScale: CGFloat = 1.0

    private var isDone: Bool {
        if case .done = model.state { return true }
        return false
    }

    var body: some View {
        Group {
            if model.state != .hidden {
                content
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.black.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(borderColor, lineWidth: 0.5)
                    )
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.state)
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .recording, .transcribing, .error:
            compactContent
        case .done:
            doneContent
                .frame(maxWidth: 280, alignment: .leading)
        case .hidden:
            EmptyView()
        }
    }

    // MARK: - Compact pill (recording / transcribing / error)

    @ViewBuilder
    private var compactContent: some View {
        HStack(spacing: 6) {
            switch model.state {
            case .recording:
                Circle()
                    .fill(Color.red.opacity(0.8))
                    .frame(width: 6, height: 6)
                    .overlay(
                        Circle()
                            .stroke(Color.red.opacity(0.4), lineWidth: 1)
                            .scaleEffect(pulseScale)
                            .opacity(2.0 - Double(pulseScale))
                    )
                    .onAppear {
                        pulseScale = 1.0
                        withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
                            pulseScale = 1.6
                        }
                    }

                Text("Recording")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.white.opacity(0.8))

            case .transcribing:
                ProgressView()
                    .scaleEffect(0.35)
                    .frame(width: 8, height: 8)
                    .colorScheme(.dark)

                Text("Transcribing...")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.white.opacity(0.8))

            case .error(let message):
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange.opacity(0.8))
                    .font(.system(size: 8))

                Text(message)
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.white.opacity(0.8))
                    .lineLimit(1)
                    .truncationMode(.tail)

            default:
                EmptyView()
            }
        }
    }

    // MARK: - Expanded rounded rect (done)

    @ViewBuilder
    private var doneContent: some View {
        if case .done(let text) = model.state {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green.opacity(0.8))
                    .font(.system(size: 8))
                    .padding(.top, 1)

                Text(text)
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.white.opacity(0.8))
                    .lineLimit(6)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var borderColor: Color {
        switch model.state {
        case .recording: return .red.opacity(0.4)
        case .done: return .green.opacity(0.4)
        case .error: return .orange.opacity(0.4)
        default: return .white.opacity(0.15)
        }
    }
}

// MARK: - Overlay Window Manager

class OverlayWindowManager {
    static let shared = OverlayWindowManager()

    private var panel: NSPanel?
    private var dismissTimer: DispatchWorkItem?

    private let panelSize = NSSize(width: 300, height: 120)

    func show(state: OverlayState) {
        dismissTimer?.cancel()
        dismissTimer = nil

        if state == .hidden {
            hide()
            return
        }

        ensurePanel()

        // Update the shared model — SwiftUI will re-render automatically
        OverlayViewModel.shared.state = state

        panel?.alphaValue = 1
        panel?.orderFront(nil)

        // Auto-dismiss "done" and "error" states
        if case .done = state {
            scheduleDismiss(after: 3.0)
        } else if case .error = state {
            scheduleDismiss(after: 5.0)
        }
    }

    func hide() {
        dismissTimer?.cancel()
        dismissTimer = nil

        guard let panel = panel, panel.isVisible else { return }

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.25
            panel.animator().alphaValue = 0
        } completionHandler: {
            OverlayViewModel.shared.state = .hidden
            self.panel?.orderOut(nil)
            self.panel?.alphaValue = 1
        }
    }

    private func ensurePanel() {
        guard panel == nil else { return }

        let hosting = NSHostingView(rootView: RecordingOverlayView())
        hosting.translatesAutoresizingMaskIntoConstraints = false

        let screen = NSScreen.main ?? NSScreen.screens[0]
        let size = panelSize
        let x = screen.visibleFrame.midX - size.width / 2
        let y = screen.visibleFrame.minY + 10

        let panel = NSPanel(
            contentRect: NSRect(x: x, y: y, width: size.width, height: size.height),
            styleMask: [.nonactivatingPanel, .fullSizeContentView, .borderless],
            backing: .buffered,
            defer: true
        )
        panel.isFloatingPanel = true
        panel.level = .statusBar
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        panel.isMovableByWindowBackground = false
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.ignoresMouseEvents = true

        let wrapper = NSView(frame: NSRect(origin: .zero, size: size))
        wrapper.autoresizingMask = [.width, .height]
        wrapper.addSubview(hosting)
        NSLayoutConstraint.activate([
            hosting.centerXAnchor.constraint(equalTo: wrapper.centerXAnchor),
            hosting.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor),
            hosting.widthAnchor.constraint(lessThanOrEqualTo: wrapper.widthAnchor),
            hosting.heightAnchor.constraint(lessThanOrEqualTo: wrapper.heightAnchor),
        ])
        panel.contentView = wrapper

        self.panel = panel
    }

    private func scheduleDismiss(after seconds: TimeInterval) {
        let item = DispatchWorkItem { [weak self] in
            self?.hide()
        }
        dismissTimer = item
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: item)
    }
}
