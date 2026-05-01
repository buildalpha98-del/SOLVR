//
//  VoiceState.swift
//  BuildAlphaCapacitorVoice
//
//  Pure-Swift state machine for the VoIP call lifecycle. No CallKit, PushKit,
//  or TwilioVoice imports — that's the point. This file is the only piece of
//  the plugin that's unit-testable without a real device, so it's deliberately
//  kept dependency-free.
//
//  Allowed transitions:
//    idle       -> incoming   (PushKit incoming-call push received)
//    idle       -> connecting (outbound call kicked off)
//    incoming   -> connecting (user tapped Accept)
//    incoming   -> ended      (user tapped Decline)
//    incoming   -> cancelled  (server fan-out 'cancel' push received)
//    connecting -> connected  (Twilio audio handshake completed)
//    connecting -> ended      (handshake failed)
//    connected  -> ended      (any party hung up)
//    ended      -> idle       (settle)
//    cancelled  -> idle       (settle)
//
//  Anything not in that list throws VoiceStateError.invalidTransition so we
//  fail loudly in tests and logs rather than silently corrupting the state.
//

import Foundation

/// High-level lifecycle of a single voice call. Mirrors the JS-layer
/// expectations in `definitions.ts` but doesn't expose itself to JS directly —
/// the bridge collapses these into discrete events (incomingCall, callConnected,
/// callEnded, etc.).
public enum VoiceCallState: String {
    case idle
    case incoming
    case connecting
    case connected
    case ended
    case cancelled
}

public enum VoiceStateError: Error, Equatable {
    case invalidTransition(from: VoiceCallState, to: VoiceCallState)
}

/// Thread-affinity note: this class assumes single-threaded access (main queue
/// in production, test queue in XCTest). Don't share an instance across
/// queues without external synchronization.
public final class VoiceStateMachine {
    public private(set) var state: VoiceCallState = .idle
    public private(set) var currentCallSid: String?

    public init() {}

    /// Attempt to move to `newState`. Throws if the transition isn't allowed.
    /// `callSid` is captured when entering `incoming` or `connecting` (call start)
    /// and cleared when returning to `idle`.
    public func transition(to newState: VoiceCallState, callSid: String? = nil) throws {
        let pair = (state, newState)
        switch pair {
        // From idle
        case (.idle, .incoming):
            currentCallSid = callSid
        case (.idle, .connecting):
            currentCallSid = callSid

        // From incoming
        case (.incoming, .connecting):
            // Keep existing callSid (set when transitioning into incoming).
            break
        case (.incoming, .ended):
            break
        case (.incoming, .cancelled):
            break

        // From connecting
        case (.connecting, .connected):
            break
        case (.connecting, .ended):
            break

        // From connected
        case (.connected, .ended):
            break

        // Settle paths
        case (.ended, .idle):
            currentCallSid = nil
        case (.cancelled, .idle):
            currentCallSid = nil

        default:
            throw VoiceStateError.invalidTransition(from: state, to: newState)
        }

        state = newState
    }

    /// Force the machine back to idle. Used as a safety net on plugin teardown
    /// or when the host JS calls disconnect on a nonsensical state.
    public func reset() {
        state = .idle
        currentCallSid = nil
    }
}
