import UIKit
import SharedKit

class KeyboardViewController: UIInputViewController {
    private var nextKeyboardButton: UIButton!
    private var recordButton: UIButton!
    private var insertButton: UIButton!
    private var clearButton: UIButton!
    private var statusLabel: UILabel!
    private var transcriptionPreview: UILabel!
    private var activityIndicator: UIActivityIndicatorView!

    private let viewModel = KeyboardViewModel()

    private enum LayoutConstants {
        static let horizontalPadding: CGFloat = 16
        static let verticalPadding: CGFloat = 8
        static let buttonHeight: CGFloat = 44
        static let spacing: CGFloat = 8
        static let cornerRadius: CGFloat = 10
        static let previewMaxHeight: CGFloat = 60
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        viewModel.configure(inputViewController: self)
        setupViewModel()
        setupUI()
        viewModel.checkForExistingResult()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        viewModel.resumePollingIfNeeded()
        viewModel.checkForExistingResult()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        viewModel.suspendPolling()
    }

    deinit {
        viewModel.stopPolling()
    }

    private func setupViewModel() {
        viewModel.onStateChanged = { [weak self] state in
            DispatchQueue.main.async {
                self?.updateUI(for: state)
            }
        }

        viewModel.onTextReady = { [weak self] text in
            DispatchQueue.main.async {
                self?.insertText(text)
            }
        }
    }

    private func setupUI() {
        view.backgroundColor = .systemBackground

        let containerStack = UIStackView()
        containerStack.axis = .vertical
        containerStack.alignment = .fill
        containerStack.spacing = LayoutConstants.spacing
        containerStack.translatesAutoresizingMaskIntoConstraints = false

        statusLabel = UILabel()
        statusLabel.text = "Whisper Keyboard"
        statusLabel.textAlignment = .center
        statusLabel.font = .systemFont(ofSize: 13, weight: .medium)
        statusLabel.textColor = .secondaryLabel
        containerStack.addArrangedSubview(statusLabel)

        transcriptionPreview = UILabel()
        transcriptionPreview.textAlignment = .left
        transcriptionPreview.font = .systemFont(ofSize: 14)
        transcriptionPreview.textColor = .label
        transcriptionPreview.numberOfLines = 3
        transcriptionPreview.isHidden = true
        transcriptionPreview.setContentHuggingPriority(.required, for: .vertical)
        containerStack.addArrangedSubview(transcriptionPreview)

        activityIndicator = UIActivityIndicatorView(style: .medium)
        activityIndicator.hidesWhenStopped = true
        activityIndicator.isHidden = true

        recordButton = makeButton(
            title: "Record",
            icon: "mic.fill",
            color: .systemBlue,
            action: #selector(recordTapped)
        )

        insertButton = makeButton(
            title: "Insert",
            icon: "text.append",
            color: .systemGreen,
            action: #selector(insertTapped)
        )
        insertButton.isHidden = true

        clearButton = makeButton(
            title: "Clear",
            icon: "xmark",
            color: .systemRed,
            action: #selector(clearTapped)
        )
        clearButton.isHidden = true

        nextKeyboardButton = UIButton(type: .system)
        nextKeyboardButton.setTitle("ABC", for: .normal)
        nextKeyboardButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .touchUpInside)
        nextKeyboardButton.translatesAutoresizingMaskIntoConstraints = false
        nextKeyboardButton.heightAnchor.constraint(equalToConstant: LayoutConstants.buttonHeight).isActive = true

        let topButtonStack = UIStackView(arrangedSubviews: [activityIndicator, recordButton])
        topButtonStack.axis = .horizontal
        topButtonStack.spacing = LayoutConstants.spacing
        topButtonStack.alignment = .center

        containerStack.addArrangedSubview(topButtonStack)
        containerStack.addArrangedSubview(insertButton)
        containerStack.addArrangedSubview(clearButton)
        containerStack.addArrangedSubview(nextKeyboardButton)

        view.addSubview(containerStack)
        NSLayoutConstraint.activate([
            containerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: LayoutConstants.horizontalPadding),
            containerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -LayoutConstants.horizontalPadding),
            containerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: LayoutConstants.verticalPadding),
            containerStack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -LayoutConstants.verticalPadding),
        ])
    }

    private func makeButton(title: String, icon: String, color: UIColor, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.heightAnchor.constraint(equalToConstant: LayoutConstants.buttonHeight).isActive = true
        button.layer.cornerRadius = LayoutConstants.cornerRadius
        button.backgroundColor = color.withAlphaComponent(0.15)
        button.setTitleColor(color, for: .normal)

        let config = UIButton.Configuration.plain()
        button.configuration = config

        var filledConfig = UIButton.Configuration.filled()
        filledConfig.baseBackgroundColor = color.withAlphaComponent(0.15)
        filledConfig.baseForegroundColor = color
        filledConfig.cornerStyle = .large
        filledConfig.imagePadding = 6

        let imageConfig = UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold)
        filledConfig.image = UIImage(systemName: icon, withConfiguration: imageConfig)
        filledConfig.title = title
        filledConfig.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = .systemFont(ofSize: 15, weight: .semibold)
            return outgoing
        }

        button.configuration = filledConfig
        button.addTarget(self, action: action, for: .touchUpInside)

        return button
    }

    private func updateUI(for state: KeyboardState) {
        switch state {
        case .idle:
            statusLabel.text = "Tap Record to start"
            statusLabel.textColor = .secondaryLabel
            recordButton.isHidden = false
            recordButton.configuration?.title = "Record"
            recordButton.configuration?.image = UIImage(systemName: "mic.fill")
            insertButton.isHidden = true
            clearButton.isHidden = true
            activityIndicator.isHidden = true
            activityIndicator.stopAnimating()
            transcriptionPreview.isHidden = true
            transcriptionPreview.text = nil

        case .requestingHostApp:
            statusLabel.text = "Opening Whisper App..."
            statusLabel.textColor = .systemBlue
            recordButton.isHidden = true
            insertButton.isHidden = true
            clearButton.isHidden = true
            activityIndicator.isHidden = false
            activityIndicator.startAnimating()

        case .waitingForResult:
            statusLabel.text = "Waiting for transcription..."
            statusLabel.textColor = .systemOrange
            recordButton.isHidden = true
            insertButton.isHidden = true
            clearButton.isHidden = false
            activityIndicator.isHidden = false
            activityIndicator.startAnimating()

        case .resultReady(let text):
            statusLabel.text = "Transcription ready"
            statusLabel.textColor = .systemGreen
            recordButton.isHidden = true
            insertButton.isHidden = false
            clearButton.isHidden = false
            activityIndicator.isHidden = true
            activityIndicator.stopAnimating()
            transcriptionPreview.isHidden = false
            transcriptionPreview.text = text

        case .error(let message):
            statusLabel.text = message
            statusLabel.textColor = .systemRed
            recordButton.isHidden = false
            recordButton.configuration?.title = "Retry"
            recordButton.configuration?.image = UIImage(systemName: "arrow.clockwise")
            insertButton.isHidden = true
            clearButton.isHidden = true
            activityIndicator.isHidden = true
            activityIndicator.stopAnimating()
            transcriptionPreview.isHidden = true
        }
    }

    @objc private func recordTapped() {
        viewModel.startRecording()
    }

    @objc private func insertTapped() {
        viewModel.insertTranscription()
    }

    @objc private func clearTapped() {
        viewModel.clearResult()
    }

    private func insertText(_ text: String) {
        textDocumentProxy.insertText(text)
        viewModel.clearResult()
    }

    override func textDidChange(_ textInput: UITextInput?) {}
}
