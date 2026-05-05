//
//  VoiceStateTests.swift
//  BuildAlphaCapacitorVoiceTests
//
//  XCTest cases for VoiceStateMachine — the only piece of the plugin we can
//  exercise without a real iOS device. PushKit, CallKit, and TwilioVoice all
//  require device hardware (or expensive simulator scaffolding), so the
//  remaining components are validated by Task 3.5 device testing.
//
//  These tests are designed to drop into either:
//    1. An XCTest target inside the host app's Xcode project, or
//    2. A standalone SPM/Pod target if Task 3.5 sets one up.
//
//  No test relies on Capacitor, PushKit, CallKit, or TwilioVoice — only on
//  VoiceState.swift, which is pure Swift.
//

import XCTest
@testable import BuildAlphaCapacitorVoice

final class VoiceStateTests: XCTestCase {

    // MARK: - 1. Default state

    func test_defaultStateIsIdle() {
        let machine = VoiceStateMachine()
        XCTAssertEqual(machine.state, .idle)
        XCTAssertNil(machine.currentCallSid)
    }

    // MARK: - 2. idle -> incoming sets callSid

    func test_idleToIncomingCapturesCallSid() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .incoming, callSid: "CA123")
        XCTAssertEqual(machine.state, .incoming)
        XCTAssertEqual(machine.currentCallSid, "CA123")
    }

    // MARK: - 3. idle -> connecting (outbound)

    func test_idleToConnectingCapturesCallSid() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .connecting, callSid: "CA-out-1")
        XCTAssertEqual(machine.state, .connecting)
        XCTAssertEqual(machine.currentCallSid, "CA-out-1")
    }

    // MARK: - 4. incoming -> connecting (user accepted)

    func test_incomingToConnectingPreservesCallSid() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .incoming, callSid: "CA-acc-1")
        try machine.transition(to: .connecting)
        XCTAssertEqual(machine.state, .connecting)
        XCTAssertEqual(machine.currentCallSid, "CA-acc-1")
    }

    // MARK: - 5. incoming -> ended (user rejected)

    func test_incomingToEndedOnReject() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .incoming, callSid: "CA-rej-1")
        try machine.transition(to: .ended)
        XCTAssertEqual(machine.state, .ended)
    }

    // MARK: - 6. incoming -> cancelled (multi-device fan-out)

    /// This is the multi-device fan-out path: another device accepted, server
    /// fans out a cancel push, this device dismisses.
    func test_incomingToCancelledOnFanoutCancel() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .incoming, callSid: "CA-fan-1")
        try machine.transition(to: .cancelled)
        XCTAssertEqual(machine.state, .cancelled)
    }

    // MARK: - 7. connecting -> connected

    func test_connectingToConnected() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .connecting, callSid: "CA-c-1")
        try machine.transition(to: .connected)
        XCTAssertEqual(machine.state, .connected)
    }

    // MARK: - 8. connected -> ended

    func test_connectedToEnded() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .connecting, callSid: "CA-h-1")
        try machine.transition(to: .connected)
        try machine.transition(to: .ended)
        XCTAssertEqual(machine.state, .ended)
    }

    // MARK: - 9. idle -> connected (skipping incoming) THROWS

    func test_idleToConnectedThrows() {
        let machine = VoiceStateMachine()
        XCTAssertThrowsError(try machine.transition(to: .connected, callSid: "X")) { error in
            guard let e = error as? VoiceStateError else {
                XCTFail("Wrong error type"); return
            }
            XCTAssertEqual(e, .invalidTransition(from: .idle, to: .connected))
        }
    }

    // MARK: - 10. connected -> incoming (going backwards) THROWS

    func test_connectedToIncomingThrows() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .connecting, callSid: "X")
        try machine.transition(to: .connected)
        XCTAssertThrowsError(try machine.transition(to: .incoming, callSid: "Y")) { error in
            guard let e = error as? VoiceStateError else {
                XCTFail("Wrong error type"); return
            }
            XCTAssertEqual(e, .invalidTransition(from: .connected, to: .incoming))
        }
    }

    // MARK: - 11. ended -> idle (settle)

    func test_endedToIdleSettlesAndClearsCallSid() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .incoming, callSid: "CA-s-1")
        try machine.transition(to: .ended)
        try machine.transition(to: .idle)
        XCTAssertEqual(machine.state, .idle)
        XCTAssertNil(machine.currentCallSid)
    }

    // MARK: - 12. cancelled -> idle (settle)

    func test_cancelledToIdleSettlesAndClearsCallSid() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .incoming, callSid: "CA-fan-2")
        try machine.transition(to: .cancelled)
        try machine.transition(to: .idle)
        XCTAssertEqual(machine.state, .idle)
        XCTAssertNil(machine.currentCallSid)
    }

    // MARK: - bonus: reset() returns to idle from any state

    func test_resetReturnsToIdle() throws {
        let machine = VoiceStateMachine()
        try machine.transition(to: .connecting, callSid: "X")
        try machine.transition(to: .connected)
        machine.reset()
        XCTAssertEqual(machine.state, .idle)
        XCTAssertNil(machine.currentCallSid)
    }
}
