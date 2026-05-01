//
//  BuildAlphaVoicePlugin.swift
//  BuildAlphaCapacitorVoice
//
//  Capacitor plugin entry point. Bridges JS calls in `definitions.ts` to the
//  underlying iOS subsystems (PushKit / CallKit / TwilioVoice) and forwards
//  their events back up to JS. Solvr-blind by design — no business logic.
//
//  Apple's reportNewIncomingCall-synchronously rule is enforced here:
//  `didReceiveIncomingCall` and `didReceiveCallCancel` (called from the
//  PushKitDelegate on the same call stack as the PushKit handler) both call
//  `callKit.reportIncomingCall` BEFORE returning. See PushKitDelegate.swift
//  for the rationale.
//

import Foundation
import UIKit
import AVFoundation
import CallKit
import Capacitor

@objc(BuildAlphaVoicePlugin)
public class BuildAlphaVoicePlugin: CAPPlugin {

    // MARK: - Subsystems

    private let pushKitDelegate = PushKitDelegate()
    private let callKit = CallKitProvider()
    private let twilio = TwilioVoiceClient()
    private let stateMachine = VoiceStateMachine()

    // MARK: - Double-emission guard (Fix C)
    //
    // When the user hangs up locally:
    //   1. callKit.endCall(uuid:) → CXEndCallAction → providerDidPerformEndCall
    //      fires on .main → emits callEnded("local") → transitions to .ended.
    //   2. Twilio's callDidDisconnect fires afterward → twilioCallDidDisconnect
    //      would emit a second callEnded("local").
    //
    // `didEmitCallEnded` prevents the duplicate. It is reset when the state
    // machine returns to .idle (end of every call) and on reset().

    private var didEmitCallEnded: Bool = false

    /// Emits "callEnded" exactly once per call lifecycle.
    private func emitCallEndedIfFirst(payload: [String: Any]) {
        guard !didEmitCallEnded else { return }
        didEmitCallEnded = true
        notifyListeners("callEnded", data: payload)
    }

    /// Called whenever the state machine settles to .idle or on hard reset.
    private func resetCallEndedFlag() {
        didEmitCallEnded = false
    }

    /// Capacitor calls this once when the plugin loads. We wire up the
    /// subsystem delegates here so they survive for the app lifetime.
    public override func load() {
        pushKitDelegate.output = self
        callKit.output = self
        twilio.output = self
        pushKitDelegate.register()
    }

    // MARK: - JS-exposed methods

    @objc func registerVoipPush(_ call: CAPPluginCall) {
        // If iOS already handed us a token before JS got around to asking,
        // return it immediately. Otherwise the `voipTokenUpdated` event will
        // fire as soon as PKPushRegistry finishes registration.
        if let token = pushKitDelegate.currentToken() {
            call.resolve([
                "token": token,
                "platform": "ios"
            ])
            return
        }
        // Resolve with empty token — JS should also subscribe to
        // voipTokenUpdated to receive the token when it arrives.
        call.resolve([
            "token": "",
            "platform": "ios"
        ])
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), !token.isEmpty else {
            call.reject("token is required")
            return
        }
        let toNumber = call.getString("toNumber") ?? ""
        let params = call.getObject("params") as? [String: String] ?? [:]

        Permissions.requestMicrophone { [weak self] granted in
            guard let self = self else { return }
            guard granted else {
                call.reject("Microphone permission denied")
                return
            }

            let uuid = UUID()
            do {
                try self.stateMachine.transition(to: .connecting, callSid: nil)
            } catch {
                call.reject("Invalid state for connect: \(error)")
                return
            }

            // Merge toNumber into Twilio params so the TwiML app knows where to call.
            var mergedParams = params
            if !toNumber.isEmpty {
                mergedParams["To"] = toNumber
            }

            self.callKit.startOutgoingCall(uuid: uuid, callSid: "", toNumber: toNumber) { error in
                if let error = error {
                    call.reject("CallKit start failed: \(error.localizedDescription)")
                    return
                }
                self.twilio.connect(token: token, params: mergedParams, uuid: uuid)
                // Resolve with placeholder — the real callSid arrives via callConnected.
                call.resolve(["callSid": ""])
            }
        }
    }

    @objc func acceptIncoming(_ call: CAPPluginCall) {
        // Fix E: guard against the race window where the Twilio SDK hasn't yet
        // delivered the CallInvite. If we emit callAccepted now and JS calls
        // notifyAccepted (which fans out cancel pushes to other devices), but
        // no call ever connects, the other devices drop their rings and the
        // caller hears silence.
        guard twilio.hasPendingInvite() else {
            call.reject("No incoming call to accept — invite may have expired")
            return
        }

        guard let uuid = currentCallUUID() else {
            call.reject("No incoming call to accept")
            return
        }
        let callSid = callKit.callSid(for: uuid) ?? ""

        // Emit callAccepted BEFORE accepting so JS can fire phone.notifyAccepted
        // to fan out cancel pushes to other devices receiving the same ring.
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
        notifyListeners("callAccepted", data: [
            "callSid": callSid,
            "deviceId": deviceId
        ])

        do {
            try stateMachine.transition(to: .connecting)
        } catch {
            call.reject("Invalid state for accept: \(error)")
            return
        }

        twilio.acceptCurrentInvite(uuid: uuid)
        call.resolve()
    }

    @objc func rejectIncoming(_ call: CAPPluginCall) {
        guard let uuid = currentCallUUID() else {
            call.reject("No incoming call to reject")
            return
        }
        twilio.rejectCurrentInvite()
        callKit.endCall(uuid: uuid)
        do {
            try stateMachine.transition(to: .ended)
        } catch {
            // Surface but don't fail — the call is already ended.
            CAPLog.print("[BuildAlphaVoice] reject state error: \(error)")
        }
        call.resolve()
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        twilio.disconnect()
        if let uuid = currentCallUUID() {
            callKit.endCall(uuid: uuid)
        }
        call.resolve()
    }

    @objc func setMuted(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        twilio.setMuted(muted)
        if let uuid = currentCallUUID() {
            callKit.setMuted(uuid: uuid, muted: muted)
        }
        call.resolve()
    }

    @objc func setSpeaker(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        let session = AVAudioSession.sharedInstance()
        do {
            try session.overrideOutputAudioPort(on ? .speaker : .none)
            call.resolve()
        } catch {
            call.reject("Failed to set speaker: \(error.localizedDescription)")
        }
    }

    // MARK: - Private helpers

    /// Returns the UUID of the call currently presented in CallKit, if any.
    /// We track only one call at a time (V2 surface).
    private func currentCallUUID() -> UUID? {
        if let sid = stateMachine.currentCallSid {
            return callKit.uuid(forCallSid: sid)
        }
        return nil
    }

    private func computeDuration(forCallSid callSid: String?) -> Int {
        // V2 surface returns 0 here — the JS layer computes durations from
        // server-side call records (more accurate than a phone-clock delta).
        return 0
    }
}

// MARK: - PushKitDelegateOutput

extension BuildAlphaVoicePlugin: PushKitDelegateOutput {
    func didUpdatePushCredentials(token: String) {
        notifyListeners("voipTokenUpdated", data: ["token": token])
    }

    func didInvalidatePushToken() {
        notifyListeners("voipTokenUpdated", data: ["token": ""])
    }

    /// IMPORTANT: invoked synchronously from PushKit's
    /// `didReceiveIncomingPushWith` handler. Must call
    /// `callKit.reportIncomingCall` before returning.
    func didReceiveIncomingCall(callSid: String,
                                fromNumber: String,
                                customParams: [String: String],
                                rawPayload: [String: Any]) {
        let uuid = UUID()
        // Apple-mandated synchronous report.
        callKit.reportIncomingCall(uuid: uuid, callSid: callSid, fromNumber: fromNumber)

        // Hand the raw payload to TwilioVoice so it can synthesize the invite.
        twilio.handleIncomingPushPayload(rawPayload)

        do {
            try stateMachine.transition(to: .incoming, callSid: callSid)
        } catch {
            CAPLog.print("[BuildAlphaVoice] incoming state error: \(error)")
        }

        notifyListeners("incomingCall", data: [
            "callSid": callSid,
            "fromNumber": fromNumber,
            "customParams": customParams
        ])
    }

    /// IMPORTANT: invoked synchronously from PushKit's cancel-payload path.
    /// Apple requires reportNewIncomingCall even for cancels — skipping it
    /// once permanently revokes the VoIP entitlement.
    func didReceiveCallCancel(callSid: String, rawPayload: [String: Any]) {
        let uuid = UUID()
        // Apple-mandated synchronous report — even though we're about to end
        // the call immediately, iOS still requires this to clear the push.
        callKit.reportIncomingCall(uuid: uuid, callSid: callSid, fromNumber: "Cancelled") { [weak self] _ in
            // Immediately dismiss. CXEndedReasonAnsweredElsewhere matches the
            // multi-device fan-out semantic ("another device picked up").
            self?.callKit.reportCallEnded(uuid: uuid, reason: .answeredElsewhere)
        }

        // Forward to TwilioVoice so it can settle the invite internally.
        twilio.handleIncomingPushPayload(rawPayload)

        do {
            try stateMachine.transition(to: .cancelled, callSid: callSid)
            try stateMachine.transition(to: .idle)
        } catch {
            CAPLog.print("[BuildAlphaVoice] cancel state error: \(error)")
            stateMachine.reset()
        }
        resetCallEndedFlag()

        emitCallEndedIfFirst(payload: [
            "callSid": callSid,
            "durationSeconds": 0,
            "endedBy": "remote"
        ])
    }
}

// MARK: - CallKitProviderOutput

extension BuildAlphaVoicePlugin: CallKitProviderOutput {
    func providerDidReset() {
        twilio.disconnect()
        stateMachine.reset()
        resetCallEndedFlag()
    }

    func providerDidPerformAnswerCall(uuid: UUID, callSid: String?) {
        twilio.acceptCurrentInvite(uuid: uuid)
        // The callAccepted event is also fired by the JS-driven acceptIncoming;
        // we fire here as well so lock-screen-answered calls notify the JS layer.
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
        notifyListeners("callAccepted", data: [
            "callSid": callSid ?? "",
            "deviceId": deviceId
        ])
    }

    func providerDidPerformEndCall(uuid: UUID, callSid: String?) {
        twilio.disconnect()
        do {
            try stateMachine.transition(to: .ended)
            try stateMachine.transition(to: .idle)
        } catch {
            stateMachine.reset()
        }
        emitCallEndedIfFirst(payload: [
            "callSid": callSid ?? "",
            "durationSeconds": computeDuration(forCallSid: callSid),
            "endedBy": "local"
        ])
        resetCallEndedFlag()
    }

    func providerDidPerformSetMuted(uuid: UUID, muted: Bool) {
        twilio.setMuted(muted)
    }

    func providerDidActivateAudioSession(_ audioSession: AVAudioSession) {
        twilio.audioSessionDidActivate()
    }

    func providerDidDeactivateAudioSession(_ audioSession: AVAudioSession) {
        twilio.audioSessionDidDeactivate()
    }
}

// MARK: - TwilioVoiceClientOutput

extension BuildAlphaVoicePlugin: TwilioVoiceClientOutput {
    func twilioCallDidStartConnecting(callSid: String?) {
        // No-op: state machine already at .connecting.
    }

    func twilioCallDidConnect(callSid: String) {
        do {
            try stateMachine.transition(to: .connected, callSid: callSid)
        } catch {
            CAPLog.print("[BuildAlphaVoice] connect state error: \(error)")
        }
        if let uuid = callKit.uuid(forCallSid: callSid) {
            callKit.reportOutgoingCallConnected(uuid: uuid)
        }
        notifyListeners("callConnected", data: ["callSid": callSid])
    }

    func twilioCallDidFailToConnect(callSid: String?, error: Error) {
        let nsError = error as NSError
        do {
            try stateMachine.transition(to: .ended)
            try stateMachine.transition(to: .idle)
        } catch {
            stateMachine.reset()
        }
        emitCallEndedIfFirst(payload: [
            "callSid": callSid ?? "",
            "durationSeconds": 0,
            "endedBy": "error",
            "errorCode": nsError.code
        ])
        resetCallEndedFlag()
    }

    func twilioCallDidDisconnect(callSid: String?, error: Error?) {
        let endedBy: String
        var errorCode: Int? = nil
        if let nsError = error as NSError? {
            endedBy = "error"
            errorCode = nsError.code
        } else {
            // Could be local or remote; we report "remote" by default. The
            // CXEndCallAction path already emits "local" before this fires,
            // so didEmitCallEnded will suppress the duplicate in that case.
            endedBy = stateMachine.state == .ended ? "local" : "remote"
        }
        if stateMachine.state != .idle {
            do {
                if stateMachine.state != .ended {
                    try stateMachine.transition(to: .ended)
                }
                try stateMachine.transition(to: .idle)
            } catch {
                stateMachine.reset()
            }
        }
        var payload: [String: Any] = [
            "callSid": callSid ?? "",
            "durationSeconds": 0,
            "endedBy": endedBy
        ]
        if let code = errorCode {
            payload["errorCode"] = code
        }
        emitCallEndedIfFirst(payload: payload)
        resetCallEndedFlag()
    }

    func twilioCallInviteCancelled(callSid: String) {
        if let uuid = callKit.uuid(forCallSid: callSid) {
            callKit.reportCallEnded(uuid: uuid, reason: .remoteEnded)
        }
        do {
            try stateMachine.transition(to: .cancelled, callSid: callSid)
            try stateMachine.transition(to: .idle)
        } catch {
            stateMachine.reset()
        }
        emitCallEndedIfFirst(payload: [
            "callSid": callSid,
            "durationSeconds": 0,
            "endedBy": "remote"
        ])
        resetCallEndedFlag()
    }

    func twilioRecordingReady(callSid: String, recordingSid: String) {
        notifyListeners("recordingReady", data: [
            "callSid": callSid,
            "recordingSid": recordingSid
        ])
    }
}
