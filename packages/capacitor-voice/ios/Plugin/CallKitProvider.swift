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
//  ─── Queue Invariant ────────────────────────────────────────────────────────
//  All reads and writes of `activeCalls` must happen on the main queue.
//
//  • CXProviderDelegate callbacks are already delivered on .main because we
//    call `provider.setDelegate(self, queue: .main)`.
//  • Public mutating methods (reportIncomingCall, startOutgoingCall, endCall,
//    reportCallEnded) may be called from any queue — they each wrap their body
//    in `DispatchQueue.main.async` so callers from PushKit handler threads or
//    Capacitor plugin threads are automatically serialised onto .main.
//  • CXProviderDelegate callbacks guard their entry with
//    `dispatchPrecondition(condition: .onQueue(.main))` so any future queue
//    mis-configuration crashes loudly in debug builds rather than silently
//    corrupting `activeCalls` at runtime.
//  ────────────────────────────────────────────────────────────────────────────

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
    /// MUST only be accessed on the main queue — see queue invariant above.
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
    /// iOS < 14.0 fallback removed: podspec deployment target is 14.0.
    private static func makeConfiguration() -> CXProviderConfiguration {
        let config = CXProviderConfiguration()
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.phoneNumber, .generic]
        config.supportsVideo = false
        return config
    }

    // MARK: - Public API

    /// Apple-mandated entry point for VoIP pushes. Must be invoked
    /// synchronously from inside the PushKit `didReceiveIncomingPush` handler.
    /// Safe to call from any queue — body auto-dispatches onto .main.
    func reportIncomingCall(uuid: UUID,
                            callSid: String,
                            fromNumber: String,
                            completion: ((Error?) -> Void)? = nil) {
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                completion?(NSError(domain: "BuildAlphaVoice",
                                   code: -1,
                                   userInfo: [NSLocalizedDescriptionKey: "CallKitProvider deallocated"]))
                return
            }
            let update = CXCallUpdate()
            update.remoteHandle = CXHandle(type: .phoneNumber, value: fromNumber)
            update.localizedCallerName = fromNumber
            update.hasVideo = false
            update.supportsHolding = false
            update.supportsGrouping = false
            update.supportsUngrouping = false
            update.supportsDTMF = true

            self.activeCalls[uuid] = callSid
            self.provider.reportNewIncomingCall(with: uuid, update: update) { error in
                completion?(error)
            }
        }
    }

    /// Reports an outbound call to CallKit. We start the call via CXStartCallAction
    /// so CallKit recognises the call and provides the audio session.
    /// Safe to call from any queue — body auto-dispatches onto .main.
    func startOutgoingCall(uuid: UUID,
                           callSid: String,
                           toNumber: String,
                           completion: ((Error?) -> Void)? = nil) {
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                completion?(NSError(domain: "BuildAlphaVoice",
                                   code: -1,
                                   userInfo: [NSLocalizedDescriptionKey: "CallKitProvider deallocated"]))
                return
            }
            self.activeCalls[uuid] = callSid
            let handle = CXHandle(type: .phoneNumber, value: toNumber)
            let startAction = CXStartCallAction(call: uuid, handle: handle)
            startAction.isVideo = false
            let transaction = CXTransaction(action: startAction)
            self.callController.request(transaction) { error in
                completion?(error)
            }
        }
    }

    /// Marks the outgoing call as connected so CallKit's UI updates.
    func reportOutgoingCallConnected(uuid: UUID) {
        provider.reportOutgoingCall(with: uuid, connectedAt: nil)
    }

    /// Safe to call from any queue — body auto-dispatches onto .main.
    func endCall(uuid: UUID) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let endCallAction = CXEndCallAction(call: uuid)
            let transaction = CXTransaction(action: endCallAction)
            self.callController.request(transaction) { _ in /* best-effort */ }
            self.activeCalls.removeValue(forKey: uuid)
        }
    }

    /// Reports that the call ended for a reason other than the user tapping End
    /// (e.g. remote hung up, network dropped). CallKit dismisses the UI.
    /// Safe to call from any queue — body auto-dispatches onto .main.
    func reportCallEnded(uuid: UUID, reason: CXCallEndedReason) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.provider.reportCall(with: uuid, endedAt: nil, reason: reason)
            self.activeCalls.removeValue(forKey: uuid)
        }
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
    // All callbacks are delivered on .main (see queue invariant).

    func providerDidReset(_ provider: CXProvider) {
        dispatchPrecondition(condition: .onQueue(.main))
        activeCalls.removeAll()
        output?.providerDidReset()
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        dispatchPrecondition(condition: .onQueue(.main))
        provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: nil)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        dispatchPrecondition(condition: .onQueue(.main))
        let sid = activeCalls[action.callUUID]
        output?.providerDidPerformAnswerCall(uuid: action.callUUID, callSid: sid)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        dispatchPrecondition(condition: .onQueue(.main))
        let sid = activeCalls[action.callUUID]
        output?.providerDidPerformEndCall(uuid: action.callUUID, callSid: sid)
        activeCalls.removeValue(forKey: action.callUUID)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        dispatchPrecondition(condition: .onQueue(.main))
        output?.providerDidPerformSetMuted(uuid: action.callUUID, muted: action.isMuted)
        action.fulfill()
    }

    // Audio-session activation — TwilioVoice listens here to start/stop audio.
    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        dispatchPrecondition(condition: .onQueue(.main))
        output?.providerDidActivateAudioSession(audioSession)
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        dispatchPrecondition(condition: .onQueue(.main))
        output?.providerDidDeactivateAudioSession(audioSession)
    }
}
