//
//  TwilioVoiceClient.swift
//  BuildAlphaCapacitorVoice
//
//  Wraps the TwilioVoice SDK. Owns the active TVOCall + pending TVOCallInvite,
//  forwards delegate callbacks to the Capacitor plugin via
//  TwilioVoiceClientOutput.
//
//  The plugin keeps everything Twilio-specific behind this seam so the rest of
//  the codebase only deals with primitives (callSid, error, etc.).
//

import Foundation
import AVFoundation
import TwilioVoice

protocol TwilioVoiceClientOutput: AnyObject {
    func twilioCallDidStartConnecting(callSid: String?)
    func twilioCallDidConnect(callSid: String)
    func twilioCallDidFailToConnect(callSid: String?, error: Error)
    func twilioCallDidDisconnect(callSid: String?, error: Error?)
    func twilioCallInviteCancelled(callSid: String)
    func twilioRecordingReady(callSid: String, recordingSid: String)
}

final class TwilioVoiceClient: NSObject {
    weak var output: TwilioVoiceClientOutput?

    private var activeCall: Call?
    private var pendingCallInvite: CallInvite?

    /// Outbound. Must be called on a thread where AVAudioSession can be
    /// activated by CallKit (CallKit drives that — see CallKitProvider).
    func connect(token: String, params: [String: String], uuid: UUID) {
        let connectOptions = ConnectOptions(accessToken: token) { builder in
            builder.params = params
            builder.uuid = uuid
        }
        let call = TwilioVoiceSDK.connect(options: connectOptions, delegate: self)
        activeCall = call
    }

    /// Hand the raw push payload to the SDK so it can synthesize the
    /// TVOCallInvite. The SDK then calls `callInviteReceived` on this delegate.
    func handleIncomingPushPayload(_ payload: [AnyHashable: Any]) {
        TwilioVoiceSDK.handleNotification(payload, delegate: self, delegateQueue: nil)
    }

    /// Called from the CallKit answer-action handler. The CallKit UUID flows
    /// through so Twilio can hook the audio session into the right CallKit call.
    func acceptCurrentInvite(uuid: UUID) {
        guard let invite = pendingCallInvite else { return }
        let acceptOptions = AcceptOptions(callInvite: invite) { builder in
            builder.uuid = uuid
        }
        let call = invite.accept(options: acceptOptions, delegate: self)
        activeCall = call
        pendingCallInvite = nil
    }

    func rejectCurrentInvite() {
        pendingCallInvite?.reject()
        pendingCallInvite = nil
    }

    func disconnect() {
        activeCall?.disconnect()
        activeCall = nil
    }

    func setMuted(_ muted: Bool) {
        activeCall?.isMuted = muted
    }

    /// Driven by CallKit's didActivate audioSession callback — TwilioVoice
    /// requires an explicit start before audio can flow.
    func audioSessionDidActivate() {
        // The default audio device exposes `enabled` (Obj-C BOOL) on the
        // concrete class; the protocol returned by SDK.audioDevice doesn't
        // surface it, so we cast.
        if let device = TwilioVoiceSDK.audioDevice as? DefaultAudioDevice {
            device.isEnabled = true
        }
    }

    func audioSessionDidDeactivate() {
        if let device = TwilioVoiceSDK.audioDevice as? DefaultAudioDevice {
            device.isEnabled = false
        }
    }

    func currentCallSid() -> String? {
        activeCall?.sid
    }
}

// MARK: - NotificationDelegate

extension TwilioVoiceClient: NotificationDelegate {
    func callInviteReceived(callInvite: CallInvite) {
        pendingCallInvite = callInvite
        // Note: the actual `incomingCall` event is emitted by the plugin from
        // the PushKit handler so it fires synchronously with reportNewIncomingCall.
        // The SDK callback here is just bookkeeping for accept/reject.
    }

    func cancelledCallInviteReceived(cancelledCallInvite: CancelledCallInvite, error: Error) {
        let sid = cancelledCallInvite.callSid
        pendingCallInvite = nil
        output?.twilioCallInviteCancelled(callSid: sid)
    }
}

// MARK: - CallDelegate

extension TwilioVoiceClient: CallDelegate {
    func callDidStartConnecting(call: Call) {
        output?.twilioCallDidStartConnecting(callSid: call.sid)
    }

    func callDidConnect(call: Call) {
        output?.twilioCallDidConnect(callSid: call.sid)
    }

    func callDidFailToConnect(call: Call, error: Error) {
        output?.twilioCallDidFailToConnect(callSid: call.sid, error: error)
        activeCall = nil
    }

    func callDidDisconnect(call: Call, error: Error?) {
        output?.twilioCallDidDisconnect(callSid: call.sid, error: error)
        activeCall = nil
    }

    /// TwilioVoice 6.x surfaces recording events via the call's events stream
    /// when enabled server-side. We mirror it through to JS verbatim.
    func call(call: Call,
              didReceiveQualityWarnings currentWarnings: Set<NSNumber>,
              previousWarnings: Set<NSNumber>) {
        // Quality warnings are not part of the V2 surface; leave hookable for V2.5.
    }
}
