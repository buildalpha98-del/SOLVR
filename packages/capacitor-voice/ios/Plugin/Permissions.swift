//
//  Permissions.swift
//  BuildAlphaCapacitorVoice
//
//  Microphone permission helper. Twilio Voice can't open an audio session
//  without it, so we request it lazily on the first connect/accept.
//

import Foundation
import AVFoundation

enum Permissions {
    /// Request mic permission. The completion fires on the main queue exactly
    /// once. If permission was previously granted/denied, AVAudioSession
    /// returns the cached answer synchronously on its own thread — we still
    /// hop to main to give callers a predictable thread.
    static func requestMicrophone(completion: @escaping (Bool) -> Void) {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            DispatchQueue.main.async { completion(granted) }
        }
    }

    /// Synchronous check of the current permission status, useful when we
    /// don't want to surface a permission prompt (e.g. on a cancel push).
    static var hasMicrophonePermission: Bool {
        AVAudioSession.sharedInstance().recordPermission == .granted
    }
}
