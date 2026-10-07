// Procedural score and effects for the U-boat stage. Everything is synthesized with Web Audio.

const NOTE = (name) => {
  const map = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 }
  const match = /^([A-G]#?)(-?\d)$/.exec(name)
  const semis = map[match[1]] + (Number(match[2]) - 4) * 12
  return 440 * 2 ** (semis / 12)
}

const PROGRESSIONS = {
  base: [["A2", ["A3", "C4", "E4"]], ["F2", ["F3", "A3", "C4"]], ["D2", ["D3", "F3", "A3"]], ["E2", ["E3", "G#3", "B3"]]],
  hunter: [["A1", ["A3", "C4", "E4"]], ["A#1", ["A#3", "D4", "F4"]], ["A1", ["A3", "C4", "E4"]], ["G#1", ["G#3", "B3", "E4"]]],
  pack: [["D2", ["D3", "F3", "A3"]], ["A#1", ["A#2", "D3", "F3"]], ["C2", ["C3", "E3", "G3"]], ["A1", ["A2", "C#3", "E3"]]],
}

const TEMPO = { base: 96, hunter: 78, pack: 122 }

export function createAudio(settings) {
  let ctx = null
  let master, musicBus, sfxBus, ambienceBus, reverb, reverbSend, noise, comp
  let mode = "base"
  let nextStep = 0
  let step = 0
  let timer = null
  let musicOn = settings.music
  let sfxOn = settings.sfx
  let voiceOn = settings.voice
  let ambience = null
  let duck = null
  let voices = []

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 4
      comp.attack.value = 0.004
      comp.release.value = 0.2
      master = ctx.createGain()
      master.gain.value = 0.9
      master.connect(comp).connect(ctx.destination)
      musicBus = ctx.createGain()
      musicBus.gain.value = musicOn ? 0.55 : 0
      sfxBus = ctx.createGain()
      sfxBus.gain.value = sfxOn ? 0.9 : 0
      ambienceBus = ctx.createGain()
      ambienceBus.gain.value = sfxOn ? 0.5 : 0
      duck = ctx.createGain()
      duck.gain.value = 1
      musicBus.connect(duck).connect(master)
      sfxBus.connect(master)
      ambienceBus.connect(master)
      reverb = ctx.createConvolver()
      reverb.buffer = impulse(3.2, 2.6)
      reverbSend = ctx.createGain()
      reverbSend.gain.value = 0.42
      reverbSend.connect(reverb).connect(master)
      noise = noiseBuffer(2)
      startAmbience()
    }
    if (ctx.state === "suspended") ctx.resume()
    return ctx
  }

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate
    const length = Math.floor(rate * seconds)
    const buffer = ctx.createBuffer(2, length, rate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
    }
    return buffer
  }

  function noiseBuffer(seconds) {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let brown = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      brown = (brown + 0.02 * white) / 1.02
      data[i] = i % 2 ? white : brown * 3.5
    }
    return buffer
  }

  function env(gainNode, when, attack, peak, hold, release) {
    const g = gainNode.gain
    g.cancelScheduledValues(when)
    g.setValueAtTime(0.0001, when)
    g.linearRampToValueAtTime(peak, when + attack)
    g.setValueAtTime(peak, when + attack + hold)
    g.exponentialRampToValueAtTime(0.0001, when + attack + hold + release)
    return when + attack + hold + release
  }

  function osc(type, freq, when, length, peak, bus, opts = {}) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, when)
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, when + (opts.glideTime || length))
    if (opts.detune) o.detune.value = opts.detune
    const g = ctx.createGain()
    let tail = g
    if (opts.filter) {
      const f = ctx.createBiquadFilter()
      f.type = opts.filter.type || "lowpass"
      f.frequency.setValueAtTime(opts.filter.freq, when)
      if (opts.filter.to) f.frequency.exponentialRampToValueAtTime(opts.filter.to, when + (opts.filter.time || length))
      f.Q.value = opts.filter.q || 0.7
      o.connect(f).connect(g)
    } else o.connect(g)
    const end = env(g, when, opts.attack ?? 0.005, peak, opts.hold ?? 0, length)
    tail.connect(bus)
    if (opts.wet) {
      const send = ctx.createGain()
      send.gain.value = opts.wet
      tail.connect(send).connect(reverbSend)
    }
    o.start(when)
    o.stop(end + 0.05)
    return o
  }

  function hiss(when, length, peak, bus, filter, opts = {}) {
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    src.playbackRate.value = opts.rate || 1
    const f = ctx.createBiquadFilter()
    f.type = filter.type || "bandpass"
    f.frequency.setValueAtTime(filter.freq, when)
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, when + (filter.time || length))
    f.Q.value = filter.q || 1
    const g = ctx.createGain()
    src.connect(f).connect(g).connect(bus)
    if (opts.wet) {
      const send = ctx.createGain()
      send.gain.value = opts.wet
      g.connect(send).connect(reverbSend)
    }
    const end = env(g, when, opts.attack ?? 0.003, peak, opts.hold ?? 0, length)
    src.start(when, Math.random() * 1.5)
    src.stop(end + 0.05)
  }

  function startAmbience() {
    if (ambience) return
    const hum = ctx.createOscillator()
    hum.type = "sawtooth"
    hum.frequency.value = 49
    const humFilter = ctx.createBiquadFilter()
    humFilter.type = "lowpass"
    humFilter.frequency.value = 140
    const humGain = ctx.createGain()
    humGain.gain.value = 0.06
    hum.connect(humFilter).connect(humGain).connect(ambienceBus)
    const water = ctx.createBufferSource()
    water.buffer = noise
    water.loop = true
    const waterFilter = ctx.createBiquadFilter()
    waterFilter.type = "lowpass"
    waterFilter.frequency.value = 380
    const waterGain = ctx.createGain()
    waterGain.gain.value = 0.11
    water.connect(waterFilter).connect(waterGain).connect(ambienceBus)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 160
    lfo.connect(lfoGain).connect(waterFilter.frequency)
    hum.start()
    water.start()
    lfo.start()
    ambience = { hum, water, lfo }
    scheduleCreaks()
  }

  function scheduleCreaks() {
    const fire = () => {
      if (ctx && sfxOn) {
        const now = ctx.currentTime
        const roll = Math.random()
        if (roll < 0.45) {
          osc("sawtooth", 70 + Math.random() * 40, now, 1.4, 0.02, ambienceBus, {
            glide: 50 + Math.random() * 30, filter: { freq: 500, to: 180, q: 6 }, attack: 0.4, wet: 0.5,
          })
        } else if (roll < 0.8) {
          for (let i = 0; i < 3; i++) bubble(now + i * 0.09 + Math.random() * 0.05, ambienceBus, 0.035)
        } else {
          metal(now, 0.03, ambienceBus, 0.6)
        }
      }
      setTimeout(fire, 3500 + Math.random() * 6000)
    }
    setTimeout(fire, 2500)
  }

  function bubble(when, bus = sfxBus, peak = 0.08) {
    const f = 500 + Math.random() * 700
    osc("sine", f, when, 0.09, peak, bus, { glide: f * 2.4, glideTime: 0.08, attack: 0.002, wet: 0.2 })
  }

  function metal(when, peak, bus = sfxBus, wet = 0.4) {
    ;[318, 761, 1187, 1747, 2633].forEach((freq, index) => {
      osc("sine", freq * (0.98 + Math.random() * 0.04), when, 0.5 + index * 0.18, peak / (1 + index * 0.6), bus, { attack: 0.001, wet })
    })
  }

  function kick(when, peak = 0.5) {
    osc("sine", 140, when, 0.38, peak, musicBus, { glide: 38, glideTime: 0.14, attack: 0.002 })
  }

  function snare(when, peak = 0.16) {
    hiss(when, 0.16, peak, musicBus, { type: "bandpass", freq: 2200, q: 0.8 }, { wet: 0.25 })
    osc("triangle", 190, when, 0.08, peak * 0.6, musicBus, { glide: 140, attack: 0.001 })
  }

  function hat(when, peak = 0.035) {
    hiss(when, 0.04, peak, musicBus, { type: "highpass", freq: 7000, q: 0.5 })
  }

  function pad(chord, when, length, peak) {
    chord.forEach((name) => {
      ;[-9, 9].forEach((detune) => {
        osc("sawtooth", NOTE(name), when, 0.9, peak, musicBus, {
          detune, attack: length * 0.35, hold: length * 0.45, filter: { freq: mode === "pack" ? 1400 : 900, q: 0.6 }, wet: 0.5,
        })
      })
    })
  }

  function bassNote(name, when, length, peak) {
    osc("sawtooth", NOTE(name), when, length, peak, musicBus, {
      attack: 0.01, filter: { freq: 900, to: 160, time: length, q: 4 },
    })
    osc("sine", NOTE(name) / 2, when, length, peak * 0.8, musicBus, { attack: 0.01 })
  }

  function lead(name, when, length, peak) {
    osc("square", NOTE(name), when, length, peak, musicBus, {
      attack: 0.02, filter: { freq: 2400, to: 900, q: 1 }, wet: 0.45,
    })
  }

  function stab(chord, when, peak) {
    chord.forEach((name) => {
      osc("sawtooth", NOTE(name) * 2, when, 0.22, peak, musicBus, {
        attack: 0.006, filter: { freq: 3200, to: 600, time: 0.2, q: 2 }, wet: 0.35,
      })
    })
  }

  function ping(when, freq = 1320, peak = 0.12) {
    osc("sine", freq, when, 1.6, peak, sfxBus, { attack: 0.004, wet: 1.4 })
    osc("sine", freq * 2.01, when, 0.4, peak * 0.25, sfxBus, { attack: 0.004, wet: 1 })
  }

  const HUNTER_MELODY = ["E5", null, null, null, "D5", null, "C5", null, "B4", null, null, null, null, null, null, null]
  const BASE_MELODY = [
    ["A4", "C5", "E5", "D5"], ["C5", "A4", "F4", "A4"], ["D5", "F5", "E5", "D5"], ["B4", "G#4", "E4", "B4"],
  ]

  function scheduleStep(when) {
    const prog = PROGRESSIONS[mode]
    const bar = Math.floor(step / 16) % prog.length
    const sixteenth = step % 16
    const [root, chord] = prog[bar]
    const beat = 60 / TEMPO[mode] / 4

    if (mode === "base") {
      if (sixteenth === 0) pad(chord, when, beat * 16, 0.016)
      if (sixteenth % 4 === 0) kick(when, sixteenth === 0 ? 0.42 : 0.24)
      if (sixteenth === 4 || sixteenth === 12) snare(when, 0.09)
      if (bar === 3 && sixteenth >= 12) snare(when, 0.03 + (sixteenth - 12) * 0.02)
      if (sixteenth % 2 === 1) hat(when)
      if (sixteenth % 2 === 0) bassNote(sixteenth % 8 === 6 ? root.replace(/\d/, (d) => String(Number(d) + 1)) : root, when, beat * 1.6, 0.07)
      if (sixteenth % 4 === 2 && Math.floor(step / 64) % 2 === 1) lead(BASE_MELODY[bar][sixteenth / 4 | 0], when, beat * 3, 0.018)
      if (sixteenth === 0 && bar === 0) ping(when + beat * 2, 1180, 0.05)
    } else if (mode === "hunter") {
      if (sixteenth === 0) pad(chord, when, beat * 16, 0.02)
      if (sixteenth === 0 || sixteenth === 3) kick(when, sixteenth === 0 ? 0.38 : 0.2)
      if (sixteenth === 8) bassNote(root, when, beat * 6, 0.09)
      if (sixteenth === 0 && bar % 2 === 0) ping(when, 1250, 0.07)
      const note = HUNTER_MELODY[sixteenth]
      if (note && bar === 2) lead(note, when, beat * 4, 0.016)
      if (sixteenth % 4 === 2) hat(when, 0.018)
    } else {
      if (sixteenth === 0) pad(chord, when, beat * 16, 0.014)
      if (sixteenth % 4 === 0 || sixteenth === 10) kick(when, 0.4)
      if (sixteenth === 4 || sixteenth === 12) snare(when, 0.13)
      if (sixteenth >= 13) snare(when, 0.04)
      hat(when, sixteenth % 2 ? 0.03 : 0.02)
      bassNote(sixteenth % 4 === 3 ? root.replace(/\d/, (d) => String(Number(d) + 1)) : root, when, beat * 0.9, 0.06)
      if (sixteenth === 2 || sixteenth === 7 || sixteenth === 10) stab(chord, when, 0.02)
    }
  }

  function scheduler() {
    if (!ctx) return
    const beat = 60 / TEMPO[mode] / 4
    while (nextStep < ctx.currentTime + 0.14) {
      if (musicOn) scheduleStep(nextStep)
      nextStep += beat
      step += 1
    }
  }

  function startMusic() {
    ensure()
    if (timer) return
    nextStep = ctx.currentTime + 0.08
    step = 0
    timer = setInterval(scheduler, 25)
  }

  function setMode(next) {
    if (next === mode) return
    mode = next
    if (ctx) {
      step = 0
      nextStep = ctx.currentTime + 0.1
    }
  }

  function duckMusic(amount, seconds) {
    if (!ctx) return
    const now = ctx.currentTime
    duck.gain.cancelScheduledValues(now)
    duck.gain.setTargetAtTime(amount, now, 0.05)
    duck.gain.setTargetAtTime(1, now + seconds, 0.4)
  }

  const sfx = {
    click() {
      const now = ensure().currentTime
      osc("square", 1800, now, 0.03, 0.04, sfxBus, { attack: 0.001 })
    },
    spin() {
      const now = ensure().currentTime
      hiss(now, 0.5, 0.12, sfxBus, { type: "bandpass", freq: 400, to: 2400, time: 0.3, q: 2 }, { attack: 0.05 })
      osc("sawtooth", 80, now, 0.45, 0.06, sfxBus, { glide: 160, filter: { freq: 600, q: 3 } })
      metal(now, 0.05)
    },
    reelTick(intensity = 1) {
      const now = ensure().currentTime
      osc("square", 2600, now, 0.015, 0.012 * intensity, sfxBus, { attack: 0.001 })
    },
    stop(index = 0) {
      const now = ensure().currentTime
      osc("sine", 120 - index * 5, now, 0.2, 0.32, sfxBus, { glide: 46, glideTime: 0.12, attack: 0.001 })
      hiss(now, 0.06, 0.08, sfxBus, { type: "bandpass", freq: 1800, q: 1.5 })
      metal(now, 0.025, sfxBus, 0.2)
    },
    sonar(count = 1) {
      const now = ensure().currentTime
      ping(now, 1180 + count * 140, 0.2)
      osc("sine", 90, now, 0.4, 0.2, sfxBus, { glide: 50 })
    },
    tension() {
      const now = ensure().currentTime
      hiss(now, 1.4, 0.07, sfxBus, { type: "bandpass", freq: 300, to: 3200, time: 1.3, q: 6 }, { attack: 1.1, wet: 0.5 })
      for (let i = 0; i < 4; i++) kick(now + i * 0.42, 0.3)
    },
    win(tier = 0) {
      const now = ensure().currentTime
      const sets = [["A4", "C5", "E5"], ["A4", "C5", "E5", "A5"], ["E4", "A4", "C5", "E5", "A5"], ["A3", "E4", "A4", "C5", "E5", "A5", "C6"]]
      const notes = sets[Math.min(tier, sets.length - 1)]
      notes.forEach((name, index) => {
        const when = now + index * 0.07
        osc("triangle", NOTE(name), when, 0.6, 0.08, sfxBus, { attack: 0.003, wet: 0.5 })
        osc("sine", NOTE(name) * 2, when, 0.35, 0.03, sfxBus, { attack: 0.003, wet: 0.5 })
      })
      if (tier >= 2) metal(now, 0.06)
    },
    countTick() {
      const now = ensure().currentTime
      osc("triangle", 2400 + Math.random() * 300, now, 0.04, 0.025, sfxBus, { attack: 0.001 })
    },
    pop(index = 0) {
      const now = ensure().currentTime + index * 0.03
      hiss(now, 0.14, 0.12, sfxBus, { type: "bandpass", freq: 900, to: 3000, time: 0.12, q: 2 })
      bubble(now + 0.02)
      bubble(now + 0.07)
    },
    land() {
      const now = ensure().currentTime
      osc("sine", 160, now, 0.12, 0.12, sfxBus, { glide: 70, attack: 0.001 })
    },
    clank() {
      const now = ensure().currentTime
      metal(now, 0.14)
      osc("sine", 90, now, 0.25, 0.25, sfxBus, { glide: 50, attack: 0.001 })
    },
    hydraulic(seconds = 1) {
      const now = ensure().currentTime
      hiss(now, seconds, 0.09, sfxBus, { type: "lowpass", freq: 600, to: 1600, time: seconds, q: 3 }, { attack: 0.15 })
      osc("sawtooth", 55, now, seconds, 0.05, sfxBus, { glide: 85, filter: { freq: 300, q: 2 }, attack: 0.15 })
    },
    explosion(size = 1) {
      const now = ensure().currentTime
      duckMusic(0.3, 1.2)
      hiss(now, 2.4 * size, 0.55, sfxBus, { type: "lowpass", freq: 4000, to: 90, time: 1.6, q: 0.8 }, { wet: 0.8 })
      osc("sine", 70, now, 1.6 * size, 0.7, sfxBus, { glide: 26, glideTime: 1.2, attack: 0.003 })
      osc("sawtooth", 45, now, 0.9, 0.2, sfxBus, { glide: 25, filter: { freq: 200, q: 1 } })
      for (let i = 0; i < 8; i++) bubble(now + 0.4 + i * 0.07, sfxBus, 0.05)
    },
    launch() {
      const now = ensure().currentTime
      osc("sine", 90, now, 0.35, 0.5, sfxBus, { glide: 35, attack: 0.002 })
      hiss(now, 1.1, 0.24, sfxBus, { type: "bandpass", freq: 250, to: 2800, time: 0.9, q: 1.4 }, { attack: 0.02, wet: 0.5 })
      for (let i = 0; i < 6; i++) bubble(now + 0.1 + i * 0.05)
    },
    splash() {
      const now = ensure().currentTime
      hiss(now, 0.9, 0.22, sfxBus, { type: "highpass", freq: 900, to: 300, time: 0.8, q: 0.7 }, { wet: 0.6 })
    },
    alarm() {
      const now = ensure().currentTime
      duckMusic(0.25, 2.4)
      for (let i = 0; i < 3; i++) {
        const when = now + i * 0.72
        osc("square", 440, when, 0.5, 0.07, sfxBus, { glide: 660, glideTime: 0.45, attack: 0.02, hold: 0.1, filter: { freq: 1800, q: 1 }, wet: 0.6 })
      }
    },
    charge() {
      const now = ensure().currentTime
      metal(now, 0.1)
      osc("square", 600, now + 0.05, 0.12, 0.04, sfxBus, { glide: 1400, filter: { freq: 2000, q: 2 } })
    },
    fanfare() {
      const now = ensure().currentTime
      duckMusic(0.2, 3.5)
      const line = [["A3", "E4", "A4"], ["C4", "G4", "C5"], ["D4", "A4", "D5"], ["E4", "B4", "E5"], ["A4", "E5", "A5"]]
      line.forEach((chord, index) => {
        const when = now + index * 0.22
        const length = index === line.length - 1 ? 1.8 : 0.3
        chord.forEach((name) => {
          osc("sawtooth", NOTE(name), when, length, 0.045, sfxBus, {
            attack: 0.01, hold: index === line.length - 1 ? 0.6 : 0, filter: { freq: 3800, to: 1200, time: length, q: 1.2 }, wet: 0.6,
          })
        })
        kick(when, 0.4)
      })
      snare(now + 1.1, 0.2)
    },
    sweep() {
      const now = ensure().currentTime
      hiss(now, 1.2, 0.2, sfxBus, { type: "bandpass", freq: 200, to: 5000, time: 1.1, q: 3 }, { attack: 0.6, wet: 0.7 })
    },
  }

  const vox = new Map()

  async function preload(names) {
    await Promise.all(names.map(async (name) => {
      try {
        const response = await fetch(`vox-${name}.wav`)
        if (response.ok) vox.set(name, await response.arrayBuffer())
      } catch { /* missing sample stays silent */ }
    }))
  }

  async function voxBuffer(name) {
    const item = vox.get(name)
    if (!item) return null
    if (item instanceof AudioBuffer) return item
    const buffer = await ctx.decodeAudioData(item.slice(0))
    vox.set(name, buffer)
    return buffer
  }

  function driveCurve(amount) {
    const curve = new Float32Array(2048)
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount)
    }
    return curve
  }

  function filter(type, freq, q = 0.7, gain = 0) {
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    f.gain.value = gain
    return f
  }

  async function shout(name, opts = {}) {
    if (!voiceOn) return 0
    ensure()
    const buffer = await voxBuffer(name)
    if (!buffer) return 0
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
    const when = ctx.currentTime + (opts.delay || 0)
    const rate = opts.rate ?? 0.86
    const shaper = ctx.createWaveShaper()
    shaper.curve = driveCurve(opts.drive ?? 3)
    shaper.oversample = "2x"
    const out = ctx.createGain()
    out.gain.value = opts.gain ?? 1.4
    shaper
      .connect(filter("highpass", 130))
      .connect(filter("peaking", 1900, 1, 7))
      .connect(filter("lowshelf", 220, 0.7, 5))
      .connect(out)
    out.connect(sfxBus)
    const send = ctx.createGain()
    send.gain.value = opts.wet ?? 0.7
    out.connect(send).connect(reverbSend)
    ;[[rate, 1, 0], [rate * 0.97, 0.55, 0.018], [rate * 1.02, 0.35, 0.031]].forEach(([r, level, offset]) => {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = r
      const g = ctx.createGain()
      g.gain.value = level
      src.connect(g).connect(shaper)
      src.start(when + offset)
    })
    const length = buffer.duration / rate
    duckMusic(0.2, (opts.delay || 0) + length + 0.4)
    return length
  }

  function siren(seconds = 3, peak = 0.06) {
    const now = ensure().currentTime
    duckMusic(0.15, seconds + 0.6)
    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, now)
    out.gain.exponentialRampToValueAtTime(peak, now + 0.35)
    out.gain.setValueAtTime(peak, now + seconds - 0.9)
    out.gain.exponentialRampToValueAtTime(0.0001, now + seconds)
    const lp = filter("lowpass", 2600, 0.8)
    lp.connect(out).connect(sfxBus)
    const send = ctx.createGain()
    send.gain.value = 0.8
    out.connect(send).connect(reverbSend)
    ;[["sawtooth", 0], ["square", 7], ["sawtooth", -12]].forEach(([type, detune]) => {
      const o = ctx.createOscillator()
      o.type = type
      o.detune.value = detune
      const f = o.frequency
      f.setValueAtTime(150, now)
      f.exponentialRampToValueAtTime(640, now + 1.05)
      let t = now + 1.05
      while (t < now + seconds - 1.2) {
        f.exponentialRampToValueAtTime(470, t + 0.55)
        f.exponentialRampToValueAtTime(650, t + 1.1)
        t += 1.1
      }
      f.exponentialRampToValueAtTime(110, now + seconds)
      o.connect(lp)
      o.start(now)
      o.stop(now + seconds + 0.05)
    })
  }

  function themeBus() {
    const bus = ctx.createGain()
    bus.gain.value = musicOn ? 0.9 : 0
    bus.connect(master)
    return bus
  }

  function drum(bus, when, peak = 0.6) {
    osc("sine", 150, when, 0.45, peak, bus, { glide: 40, glideTime: 0.16, attack: 0.002 })
    hiss(when, 0.03, peak * 0.3, bus, { type: "lowpass", freq: 3000 })
  }

  function tom(bus, when, freq = 120, peak = 0.35) {
    osc("sine", freq, when, 0.35, peak, bus, { glide: freq * 0.55, glideTime: 0.3, attack: 0.002, wet: 0.4 })
  }

  function bigSnare(bus, when, peak = 0.25) {
    hiss(when, 0.4, peak, bus, { type: "bandpass", freq: 1800, q: 0.6 }, { wet: 0.9 })
    osc("triangle", 210, when, 0.12, peak * 0.7, bus, { glide: 150, attack: 0.001, wet: 0.6 })
  }

  function choir(chord, when, length, peak, bus) {
    chord.forEach((name) => {
      ;[-11, 0, 12].forEach((detune) => {
        const o = ctx.createOscillator()
        o.type = "sawtooth"
        o.frequency.value = NOTE(name)
        o.detune.value = detune
        const vib = ctx.createOscillator()
        vib.frequency.value = 5 + Math.random()
        const vibGain = ctx.createGain()
        vibGain.gain.value = 6
        vib.connect(vibGain).connect(o.detune)
        const g = ctx.createGain()
        const f1 = filter("bandpass", 760, 5)
        const f2 = filter("bandpass", 1180, 6)
        o.connect(f1).connect(g)
        o.connect(f2).connect(g)
        g.connect(bus)
        const send = ctx.createGain()
        send.gain.value = 0.8
        g.connect(send).connect(reverbSend)
        env(g, when, length * 0.3, peak, length * 0.45, length * 0.4)
        o.start(when)
        vib.start(when)
        o.stop(when + length * 1.2)
        vib.stop(when + length * 1.2)
      })
    })
  }

  function brass(chord, when, length, peak, bus) {
    chord.forEach((name) => {
      ;[-8, 8].forEach((detune) => {
        osc("sawtooth", NOTE(name), when, length, peak, bus, {
          detune, attack: 0.02, filter: { freq: 3400, to: 700, time: length, q: 1.6 }, wet: 0.55,
        })
      })
    })
  }

  const THEME = [
    ["A1", ["A3", "C4", "E4"], ["A4", "C5", "E5", "C5"]],
    ["F1", ["F3", "A3", "C4"], ["A4", "C5", "F5", "C5"]],
    ["G1", ["G3", "B3", "D4"], ["B4", "D5", "G5", "D5"]],
    ["E1", ["E3", "G#3", "B3"], ["B4", "E5", "G#5", "E5"]],
  ]

  function winTheme(tier = 3, seconds = 6) {
    ensure()
    const bus = themeBus()
    const start = ctx.currentTime + 0.06
    const beat = 60 / 132
    const bars = Math.max(1, Math.ceil(seconds / (beat * 4)))
    duckMusic(0.03, seconds + 1)
    for (let bar = 0; bar < bars; bar++) {
      const [root, chord, bells] = THEME[bar % THEME.length]
      const t = start + bar * beat * 4
      const last = bar === bars - 1
      choir(chord, t, beat * 4.2, 0.02 + tier * 0.004, bus)
      ;[0, 1.5, 2.5].forEach((b) => brass(chord, t + b * beat, b ? beat * 0.8 : beat * 1.2, 0.022, bus))
      osc("sawtooth", NOTE(root) * 2, t, beat * 4, 0.08, bus, { attack: 0.01, filter: { freq: 500, to: 140, time: beat * 4, q: 3 } })
      for (let b = 0; b < 4; b++) drum(bus, t + b * beat, b === 0 ? 0.7 : 0.45)
      bigSnare(bus, t + beat, 0.2)
      bigSnare(bus, t + beat * 3, 0.24)
      tom(bus, t + beat * 3.5, 140)
      tom(bus, t + beat * 3.75, 100)
      if (tier >= 3) {
        for (let e = 0; e < 8; e++) osc("triangle", NOTE(bells[e % 4]) * 2, t + e * beat * 0.5, 0.3, 0.025, bus, { attack: 0.002, wet: 0.7 })
      }
      if (last) {
        for (let r = 0; r < 12; r++) tom(bus, t + beat * 2 + r * beat / 6, 90 + r * 4, 0.12 + r * 0.025)
      }
    }
    const end = start + bars * beat * 4
    brass(["A3", "E4", "A4", "C5", "E5"], end, 2.4, 0.03, bus)
    choir(["A3", "C4", "E4", "A4"], end, 2.6, 0.03, bus)
    drum(bus, end, 0.9)
    hiss(end, 2.6, 0.16, bus, { type: "highpass", freq: 5000, q: 0.4 }, { wet: 0.8 })
    return {
      stop() {
        const now = ctx.currentTime
        bus.gain.cancelScheduledValues(now)
        bus.gain.setTargetAtTime(0.0001, now, 0.25)
        setTimeout(() => bus.disconnect(), 2500)
      },
      length: end - start + 2.4,
    }
  }

  function winSting(tier = 2) {
    ensure()
    const bus = themeBus()
    const now = ctx.currentTime + 0.02
    duckMusic(0.2, 1.8)
    const chord = tier >= 2 ? ["A3", "C4", "E4", "A4"] : ["C4", "E4", "A4"]
    brass(chord, now, 0.35, 0.026, bus)
    brass(chord.map((n) => n.replace(/\d/, (d) => String(Number(d) + 1))), now + 0.3, 1.1, 0.024, bus)
    choir(chord, now, 1.6, 0.02, bus)
    drum(bus, now, 0.7)
    drum(bus, now + 0.3, 0.5)
    bigSnare(bus, now + 0.3, 0.2)
    setTimeout(() => bus.disconnect(), 3000)
  }

  Object.assign(sfx, {
    nein(triple = false) {
      const now = ensure().currentTime
      siren(3.4, 0.065)
      osc("sine", 60, now, 1.8, 0.8, sfxBus, { glide: 28, glideTime: 1.4, attack: 0.002 })
      hiss(now, 1.6, 0.3, sfxBus, { type: "lowpass", freq: 2400, to: 80, time: 1.4 }, { wet: 0.8 })
      ;[["A#2", "D3", "F3"], ["A2", "C#3", "E3"], ["G#2", "C3", "D#3"]].forEach((chord, index) => {
        brass(chord, now + 0.25 + index * 0.42, index === 2 ? 1.6 : 0.45, 0.03, sfxBus)
      })
      shout(triple ? "neinx3" : "nein", { delay: 0.32, rate: triple ? 0.84 : 0.78, drive: 4.5, gain: 1.8, wet: 0.9 })
    },
    siren,
    telegraph() {
      const now = ensure().currentTime
      ;[0, 0.22].forEach((offset) => {
        ;[1320, 2650, 3960, 5210].forEach((freq, index) => {
          osc("sine", freq, now + offset, 1.2 - index * 0.2, 0.06 / (index + 1), sfxBus, { attack: 0.001, wet: 0.6 })
        })
      })
      metal(now + 0.5, 0.1)
    },
    riser(seconds = 1.5) {
      const now = ensure().currentTime
      hiss(now, seconds, 0.16, sfxBus, { type: "bandpass", freq: 300, to: 6000, time: seconds, q: 4 }, { attack: seconds * 0.9, wet: 0.6 })
      osc("sawtooth", 110, now, seconds, 0.05, sfxBus, { glide: 880, glideTime: seconds, attack: seconds * 0.8, filter: { freq: 900, to: 4000, time: seconds, q: 3 } })
    },
    impact(size = 1) {
      const now = ensure().currentTime
      osc("sine", 52, now, 1.2 * size, 0.9, sfxBus, { glide: 30, glideTime: 0.9, attack: 0.002 })
      metal(now, 0.12 * size, sfxBus, 0.8)
      hiss(now, 0.8 * size, 0.25, sfxBus, { type: "lowpass", freq: 1500, to: 100, time: 0.7 }, { wet: 0.7 })
    },
    coins(count = 12) {
      const now = ensure().currentTime
      for (let i = 0; i < count; i++) {
        const when = now + Math.random() * 0.9
        const f = 3200 + Math.random() * 1800
        osc("triangle", f, when, 0.12, 0.02, sfxBus, { attack: 0.001, wet: 0.3 })
        osc("sine", f * 1.5, when + 0.01, 0.08, 0.012, sfxBus, { attack: 0.001 })
      }
    },
    weld(seconds = 0.6) {
      const now = ensure().currentTime
      for (let i = 0; i < seconds * 30; i++) {
        hiss(now + Math.random() * seconds, 0.02 + Math.random() * 0.03, 0.06 + Math.random() * 0.06, sfxBus, { type: "highpass", freq: 2500 + Math.random() * 3000, q: 0.8 })
      }
      osc("square", 95, now, seconds, 0.02, sfxBus, { filter: { freq: 600, q: 4 }, attack: 0.02 })
    },
    ignite(seconds = 1.6) {
      const now = ensure().currentTime
      osc("sawtooth", 70, now, seconds, 0.07, sfxBus, { glide: 520, glideTime: seconds, attack: 0.2, hold: seconds * 0.5, filter: { freq: 600, to: 2600, time: seconds, q: 5 } })
      osc("square", 35, now, seconds, 0.06, sfxBus, { glide: 260, glideTime: seconds, attack: 0.3, filter: { freq: 400, q: 2 } })
      hiss(now, seconds, 0.14, sfxBus, { type: "bandpass", freq: 400, to: 2400, time: seconds, q: 1.2 }, { attack: 0.3, wet: 0.4 })
      for (let i = 0; i < 14; i++) bubble(now + i * seconds / 14)
    },
    whoosh() {
      const now = ensure().currentTime
      hiss(now, 0.7, 0.3, sfxBus, { type: "bandpass", freq: 3200, to: 300, time: 0.6, q: 1.5 }, { attack: 0.05, wet: 0.5 })
    },
    groan() {
      const now = ensure().currentTime
      osc("sawtooth", 62, now, 2.2, 0.05, sfxBus, { glide: 41, glideTime: 2, attack: 0.5, filter: { freq: 420, to: 160, time: 2, q: 9 }, wet: 0.7 })
    },
  })

  function pickVoice() {
    if (!("speechSynthesis" in window)) return null
    if (!voices.length) voices = window.speechSynthesis.getVoices()
    return voices.find((v) => /de[-_]DE/i.test(v.lang) && /Markus|Yannick|Viktor|Helmut/i.test(v.name))
      || voices.find((v) => /de[-_]DE/i.test(v.lang))
      || null
  }

  function say(text, opts = {}) {
    if (!voiceOn || !("speechSynthesis" in window)) return
    const voice = pickVoice()
    if (!voice) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text.replace(/[—·]/g, ","))
    utter.voice = voice
    utter.lang = voice.lang
    utter.rate = opts.rate || 1.02
    utter.pitch = opts.pitch || 0.75
    utter.volume = 1
    window.speechSynthesis.speak(utter)
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices()
    }
  }

  return {
    unlock() {
      ensure()
      startMusic()
    },
    setMode,
    sfx,
    say,
    shout,
    preload,
    winTheme,
    winSting,
    setMusic(on) {
      musicOn = on
      if (ctx) musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.2)
    },
    setSfx(on) {
      sfxOn = on
      if (ctx) {
        sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.1)
        ambienceBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.3)
      }
    },
    setVoice(on) {
      voiceOn = on
      if (!on && "speechSynthesis" in window) window.speechSynthesis.cancel()
    },
  }
}
