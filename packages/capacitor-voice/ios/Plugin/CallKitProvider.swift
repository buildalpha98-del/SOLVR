//
//  CallKitProvider.swift
//  BuildAlphaCapacitorVoice
//
//  Wraps CXProvider + CXCallController. CallKit owns the call lifecycle UI
//  (lock-screen ring, CarPlay, Bluetooth handoff). The plugin must drive
//  CallKit, not work around it — Apple requires it for any VoIP app.
//
//  Mirrors the structure recommended by Twilio's voice-quickstart-ios sample
//  but stripped of any business-specific configuration. The host app provides
//  the localizedName and ringtone via Info.plist or by mutating the
//  configuration before calling `register()` (Task 3.4 wires that up).
//

import Foundation
import CallKit
import AVFoundation

protocol CallKitProviderOutput: AnyObject {
    func providerDidReset()
    func providerDidPerformAnswerCall(uuid: UUID, callSid: String?)
    func providerDidPerformEndCall(uuid: UUID, callSid: String?)
    func providerDidPerformSetMuted(uuid: UUID, muted: Bool)
    func providerDidActivateAudioSession(_ audioSession: AVAudioSession)
    func providerDidDeactivateAudioSession(_ audioSession: AVAudioSession)
}

final class CallKitProvider: NSObject, CXProviderDelegate {
    weak var output: CallKitProviderOutput?

    private let provider: CXProvider
    private let callController = CXCallController()
    /// Maps CallKit's UUID to Twilio's call SID so we can correlate user
    /// actions back to a server-known identifier.
    private var activeCalls: [UUID: String] = [:]

    override init() {
        let config = CallKitProvider.makeConfiguration()
        self.provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: .main)
    }

    /// Default configuration — host app can override `localizedName` /
    /// `iconTemplateImageData` / `ringtoneSound` via Info.plist before this
    /// initialiser runs (those bundle keys take precedence in CallKit).
    private static func makeConfiguration() -> CXProviderConfiguration {
        let config: CXProviderConfiguration
        if #available(iOS 14.0, *) {
            config = CXProviderConfiguration()
        } else {
            config = CXProviderConfiguration(localizedName: "Voice")
        }
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.phoneNumber, .generic]
        config.supportsVideo = false
        return config
    }

    // MARK: - Public API

    /// Apple-mandated entry point for VoIP pushes. Must be invoked
    /// synchronously from inside the PushKit `didReceiveIncomingPush` handler.
    func reportIncomingCall(uuid: UUID,
                            callSid: String,
                            fromNumber: String,
                            completion: ((Error?) -> Void)? = nil) {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .phoneNumber, value: fromNumber)
        update.localizedCallerName = fromNumber
        update.hasVideo = false
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsDTMF = true

        activeCalls[uuid] = callSid
        provider.reportNewIncomingCall(with: uuid, update: update) { error in
            completion?(error)
        }
    }

    /// Reports an outbound call to CallKit. We start the call via CXStartCallAction
    /// so CallKit recognises the call and provides the audio session.
    func startOutgoingCall(uuid: UUID,
                           callSid: String,
                           toNumber: String,
                           completion: ((Error?) -> Void)? = nil) {
        activeCalls[uuid] = callSid
        let handle = CXHandle(type: .phoneNumber, value: toNumber)
        let startAction = CXStartCallAction(call: uuid, handle: handle)
        startAction.isVideo = false
        let transaction = CXTransaction(action: startAction)
        callController.request(transaction) { error in
            completion?(error)
        }
    }

    /// Marks the outgoing call as connected so CallKit's UI updates.
    func reportOutgoingCallConnected(uuid: UUID) {
        provider.reportOutgoingCall(with: uuid, connectedAt: nil)
    }

    func endCall(uuid: UUID) {
        let endCallAction = CXEndCallAction(call: uuid)
        let transaction = CXTransaction(action: endCallAction)
        callController.request(transaction) { _ in /* best-effort */ }
        activeCalls.removeValue(forKey: uuid)
    }

    /// Reports that the call ended for a reason other than the user tapping End
    /// (e.g. remote hung up, network dropped). CallKit dismisses the UI.
    func reportCallEnded(uuid: UUID, reason: CXCallEndedReason) {
        provider.reportCall(with: uuid, endedAt: nil, reason: reason)
        activeCalls.removeValue(forKey: uuid)
    }

    func setMuted(uuid: UUID, muted: Bool) {
        let action = CXSetMutedCallAction(call: uuid, muted: muted)
        let transaction = CXTransaction(action: action)
        callController.request(transaction) { _ in }
    }

    func callSid(for uuid: UUID) -> String? {
        activeCalls[uuid]
    }

    func uuid(forCallSid callSid: String) -> UUID? {
        activeCalls.first(where: { $0.value == callSid })?.key
    }

    // MARK: - CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        activeCalls.removeAll()
        output?.providerDidReset()
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: nil)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        let sid = activeCalls[action.callUUID]
        output?.providerDidPerformAnswerCall(uuid: action.callUUID, callSid: sid)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        let sid = activeCalls[action.callUUID]
        output?.providerDidPerformEndCall(uuid: action.callUUID, callSid: sid)
        activeCalls.removeValue(forKey: action.callUUID)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        output?.providerDidPerformSetMuted(uuid: action.callUUID, muted: action.isMuted)
        action.fulfill()
    }

    // Audio-session activation — TwilioVoice listens here to start/stop audio.
    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        output?.providerDidActivateAudioSession(audioSession)
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        output?.providerDidDeactivateAudioSession(audioSession)
    }
}
