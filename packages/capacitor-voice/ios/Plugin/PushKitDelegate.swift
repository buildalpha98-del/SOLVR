//
//  PushKitDelegate.swift
//  BuildAlphaCapacitorVoice
//
//  Wraps PKPushRegistry. Surfaces push lifecycle events through
//  PushKitDelegateOutput so the Capacitor plugin can wire them to CallKit and
//  TwilioVoice without this file knowing about either.
//
//  CRITICAL APPLE REQUIREMENT
//  --------------------------
//  Every VoIP push must trigger CXProvider.reportNewIncomingCall() *synchronously*
//  inside `pushRegistry(_:didReceiveIncomingPushWith:for:completion:)`. That
//  applies to BOTH default-type pushes (real incoming call) AND `type:"cancel"`
//  fan-out pushes — because once we accept the push, iOS demands a CallKit
//  report regardless of what the payload says. Skipping it once = iOS
//  permanently revokes the VoIP entitlement for the app.
//
//  This file doesn't *call* reportNewIncomingCall directly — it forwards the
//  event via `output` and the plugin dispatches synchronously from within the
//  same call stack. That keeps the unit-test seam clean while preserving the
//  synchronous contract.
//

import Foundation
import PushKit

protocol PushKitDelegateOutput: AnyObject {
    func didUpdatePushCredentials(token: String)
    func didInvalidatePushToken()
    func didReceiveIncomingCall(callSid: String, fromNumber: String, customParams: [String: String], rawPayload: [String: Any])
    func didReceiveCallCancel(callSid: String, rawPayload: [String: Any])
}

final class PushKitDelegate: NSObject, PKPushRegistryDelegate {
    weak var output: PushKitDelegateOutput?

    private var registry: PKPushRegistry?

    /// Stand up a PKPushRegistry on the main queue and register for VoIP. The
    /// device token will arrive asynchronously via `didUpdate`.
    func register() {
        let registry = PKPushRegistry(queue: .main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        self.registry = registry
    }

    /// Returns the cached VoIP token if iOS already issued one before we wired
    /// up the delegate. Useful for callers that come in late.
    func currentToken() -> String? {
        guard let data = registry?.pushToken(for: .voIP) else { return nil }
        return data.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - PKPushRegistryDelegate

    func pushRegistry(_ registry: PKPushRegistry,
                      didUpdate pushCredentials: PKPushCredentials,
                      for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        output?.didUpdatePushCredentials(token: token)
    }

    func pushRegistry(_ registry: PKPushRegistry,
                      didInvalidatePushTokenFor type: PKPushType) {
        guard type == .voIP else { return }
        output?.didInvalidatePushToken()
    }

    /// The hot path. Apple requires that `reportNewIncomingCall` be called on
    /// CallKit *before* this method returns. We do that by forwarding to
    /// `output` synchronously — the plugin's implementation of these protocol
    /// methods drives CallKit on the same call stack.
    func pushRegistry(_ registry: PKPushRegistry,
                      didReceiveIncomingPushWith payload: PKPushPayload,
                      for type: PKPushType,
                      completion: @escaping () -> Void) {
        guard type == .voIP else {
            completion()
            return
        }

        let dict = payload.dictionaryPayload as? [String: Any] ?? [:]
        let callSid = (dict["callSid"] as? String)
            ?? (dict["twi_call_sid"] as? String)
            ?? UUID().uuidString
        let pushType = dict["type"] as? String

        if pushType == "cancel" {
            // Multi-device fan-out: another device accepted, this one is being
            // dismissed. Plugin still MUST call reportNewIncomingCall before
            // ending — the implementation does both in didReceiveCallCancel.
            output?.didReceiveCallCancel(callSid: callSid, rawPayload: dict)
        } else {
            let fromNumber = (dict["fromNumber"] as? String)
                ?? (dict["from"] as? String)
                ?? "Unknown"
            let customParams = (dict["customParams"] as? [String: String]) ?? [:]
            output?.didReceiveIncomingCall(callSid: callSid,
                                           fromNumber: fromNumber,
                                           customParams: customParams,
                                           rawPayload: dict)
        }

        completion()
    }
}
