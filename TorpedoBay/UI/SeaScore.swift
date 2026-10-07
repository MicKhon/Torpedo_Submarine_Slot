import AVFoundation
import Foundation
import os

final class SeaScore {
    static let shared = SeaScore()

    private let engine = AVAudioEngine()
    private let state = ScoreState()
    private var source: AVAudioSourceNode?
    private var started = false

    private init() {}

    func start() {
        guard !started else { return }
        started = true
        let sampleRate = 44_100.0
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2) else { return }
        state.sampleRate = sampleRate

        let state = self.state
        let node = AVAudioSourceNode(format: format) { _, _, frameCount, audioBufferList -> OSStatus in
            let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)
            guard let left = buffers.first?.mData?.assumingMemoryBound(to: Float.self) else { return noErr }
            let right = buffers.count > 1 ? buffers[1].mData?.assumingMemoryBound(to: Float.self) : nil
            state.render(left: left, right: right, frames: Int(frameCount))
            return noErr
        }
        source = node
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = 0.9
        do {
            try engine.start()
        } catch {
            started = false
        }
    }

    var musicEnabled: Bool {
        get { state.withLock { $0.music } }
        set { state.withLock { $0.music = newValue } }
    }

    var effectsEnabled: Bool {
        get { state.withLock { $0.effects } }
        set { state.withLock { $0.effects = newValue } }
    }

    func setMode(_ mode: GameMode) {
        let value: Int
        switch mode {
        case .base: value = 0
        case .hunter: value = 1
        case .pack: value = 2
        }
        state.withLock { $0.mode = value }
    }

    func play(_ name: String) {
        let kind: Int
        switch name {
        case "Submarine": kind = 2
        case "Ping": kind = 2
        case "Glass": kind = 3
        case "Blow": kind = 4
        case "Hero": kind = 5
        case "Pop", "Tink": kind = 1
        default: kind = 1
        }
        state.withLock { $0.trigger(kind) }
    }

    func blast() {
        state.withLock { $0.trigger(6) }
    }
}

private final class ScoreState {
    var music = true
    var effects = true
    var mode = 0
    var sampleRate = 44_100.0
    var sample: Double = 0
    var noise: UInt64 = 0xC0FFEE
    var brown: Double = 0
    var melodyPhase: Double = 0
    var bassPhase: Double = 0
    var padPhase: [Double] = [0, 0, 0]
    var delay: [Double] = Array(repeating: 0, count: 2400)
    var delayIndex = 0
    var voices: [(kind: Int, age: Double)] = []
    var pending: [Int] = []
    private var lock = os_unfair_lock_s()

    func withLock<T>(_ body: (ScoreState) -> T) -> T {
        os_unfair_lock_lock(&lock)
        defer { os_unfair_lock_unlock(&lock) }
        return body(self)
    }

    func trigger(_ kind: Int) {
        pending.append(kind)
        if pending.count > 16 { pending.removeFirst(pending.count - 16) }
    }

    func render(left: UnsafeMutablePointer<Float>, right: UnsafeMutablePointer<Float>?, frames: Int) {
        var musicOn = true
        var effectsOn = true
        var currentMode = 0
        var queued: [Int] = []
        os_unfair_lock_lock(&lock)
        musicOn = music
        effectsOn = effects
        currentMode = mode
        queued = pending
        pending.removeAll(keepingCapacity: true)
        os_unfair_lock_unlock(&lock)

        for kind in queued where effectsOn {
            voices.append((kind, 0))
        }
        if voices.count > 12 { voices.removeFirst(voices.count - 12) }

        let bpm = currentMode == 2 ? 108.0 : (currentMode == 1 ? 94.0 : 78.0)
        let beat = 60.0 / bpm
        let dt = 1.0 / sampleRate
        let melody: [Double] = [220, 329.63, 261.63, 196, 220, 246.94, 329.63, 293.66]
        let padFreqs: [Double] = [110, 164.81, 220]

        for frame in 0..<frames {
            let time = sample / sampleRate
            let beatPos = time / beat
            let phase = beatPos - floor(beatPos)
            let step = Int(beatPos) % melody.count

            let white = unitNoise() - 0.5
            brown = (brown + white * 0.02) * 0.997
            let sea = brown * 0.55

            let bassFreq = currentMode == 0 ? 55.0 : 41.2
            bassPhase += bassFreq / sampleRate * 2 * .pi
            let bass = sin(bassPhase) * (0.16 + 0.04 * sin(time * 0.35))

            var pad = 0.0
            for index in 0..<3 {
                padPhase[index] += padFreqs[index] / sampleRate * 2 * .pi
                pad += sin(padPhase[index])
            }
            pad *= 0.035

            let note = melody[step] * (currentMode == 1 ? 1.5 : 1)
            melodyPhase += note / sampleRate * 2 * .pi
            let pluck = sin(melodyPhase) * exp(-phase * (currentMode == 2 ? 4.5 : 7.0))
            let tone = pluck * (currentMode == 2 ? 0.16 : 0.11)

            let kickEnv = exp(-phase * 14)
            let kick = sin(bassPhase * 0.5) * kickEnv * 0.22

            var hat = 0.0
            if currentMode == 2 {
                let off = abs(phase - 0.5)
                hat = white * exp(-off * 40) * 0.08
            }

            var musicSample = (sea * 0.22 + bass + pad + tone + kick + hat) * (musicOn ? 1 : 0)

            var effect = 0.0
            if effectsOn {
                var index = 0
                while index < voices.count {
                    let age = voices[index].age
                    let kind = voices[index].kind
                    let (sample, done) = stinger(kind, age: age, white: white)
                    effect += sample
                    voices[index].age = age + dt
                    if done {
                        voices.remove(at: index)
                    } else {
                        index += 1
                    }
                }
            }

            if abs(effect) > 0.05 { musicSample *= 0.72 }
            var mixed = tanh(musicSample + effect)

            delay[delayIndex] = mixed
            let echoAt = (delayIndex + delay.count - 900) % delay.count
            let wide = delay[echoAt] * 0.18
            delayIndex = (delayIndex + 1) % delay.count

            left[frame] = Float(mixed * 0.82)
            right?[frame] = Float(tanh(mixed * 0.78 + wide))
            sample += 1
        }
    }

    private func stinger(_ kind: Int, age: Double, white: Double) -> (Double, Bool) {
        switch kind {
        case 1:
            let env = exp(-age * 38)
            return (white * env * 0.2, age > 0.12)
        case 2:
            let freq = 880 - age * 520
            let env = exp(-age * 3.2) * (age < 0.9 ? 1 : 0)
            return (sin(age * freq * 2 * .pi) * env * 0.22, age > 1.1)
        case 3:
            let env = exp(-age * 2.4)
            let chord = sin(age * 523.25 * 2 * .pi) + sin(age * 659.25 * 2 * .pi) + sin(age * 783.99 * 2 * .pi)
            return (chord / 3 * env * 0.28, age > 1.3)
        case 4:
            let env = exp(-age * 1.6)
            let sweep = sin(age * (90 + (1 - min(age, 1)) * 220) * 2 * .pi)
            return ((sweep * 0.35 + white * 0.65) * env * 0.55, age > 1.15)
        case 5:
            let notes = [392.0, 493.88, 587.33, 784.0]
            let slot = min(notes.count - 1, Int(age / 0.14))
            let local = age - Double(slot) * 0.14
            let env = exp(-local * 6)
            return (sin(age * notes[slot] * 2 * .pi) * env * 0.3, age > 1.05)
        case 6:
            let env = exp(-age * 5)
            return (white * env * 0.7 + sin(age * 70 * 2 * .pi) * env * 0.25, age > 0.7)
        default:
            return (0, true)
        }
    }

    private func unitNoise() -> Double {
        noise = noise &* 6364136223846793005 &+ 1442695040888963407
        return Double(noise >> 40) / Double(1 << 24)
    }
}
