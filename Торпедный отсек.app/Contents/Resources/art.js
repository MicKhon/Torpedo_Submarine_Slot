import { Texture } from "pixi.js"

export const CELL_W = 140
export const CELL_H = 120
const SCALE = 2

const FONT_TITLE = "'Copperplate', 'Big Caslon', serif"
const FONT_STENCIL = "'DIN Condensed', 'Impact', 'Arial Narrow', sans-serif"

const LETTER_COLORS = {
  ten: ["#cfe3ef", "#5f86a0", "#1b2c38"],
  jack: ["#c9f2dc", "#4f9c78", "#12301f"],
  queen: ["#ffd9bd", "#c7703f", "#3a1a0c"],
  king: ["#ffc9c2", "#c23b33", "#3a0c09"],
  ace: ["#fff1c4", "#d7a443", "#3b2708"],
}

const FRAME = {
  cook: ["#9b7a52", "#4a3520"],
  radio: ["#a9b9c4", "#3c4a55"],
  engineer: ["#c98a55", "#4c2a12"],
  officer: ["#d9dee3", "#59626b"],
  captain: ["#ffd98a", "#8a5a12"],
  sonar: ["#7dffb0", "#0f5a30"],
  mine: ["#ff8a4a", "#6a1d08"],
  depth: ["#7fe8ff", "#0d4a5a"],
  periscope: ["#ffe08a", "#5a4210"],
  torpedo: ["#ffb26a", "#5a2a0a"],
}

const LABEL = {
  cook: "KOCH", radio: "FUNKER", engineer: "MASCHINIST", officer: "OFFIZIER", captain: "KAPITÄN",
  sonar: "SONAR", mine: "MINE", depth: "TIEFE", periscope: "SEHROHR", torpedo: "TORPEDO",
}

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext("2d")
  draw(g, width, height)
  return Texture.from(canvas)
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function steelPlate(g, w, h, tint = "#2a333b") {
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, shade(tint, 22))
  grad.addColorStop(0.5, tint)
  grad.addColorStop(1, shade(tint, -26))
  roundRect(g, 4, 4, w - 8, h - 8, 18)
  g.fillStyle = grad
  g.fill()
  g.save()
  g.clip()
  g.globalAlpha = 0.07
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = Math.random() < 0.5 ? "#ffffff" : "#000000"
    g.lineWidth = Math.random() * 1.4
    g.beginPath()
    const y = Math.random() * h
    g.moveTo(Math.random() * w * 0.3, y)
    g.lineTo(w * (0.6 + Math.random() * 0.4), y + (Math.random() - 0.5) * 8)
    g.stroke()
  }
  g.globalAlpha = 1
  const shine = g.createLinearGradient(0, 0, w, h)
  shine.addColorStop(0, "rgba(255,255,255,0.10)")
  shine.addColorStop(0.45, "rgba(255,255,255,0)")
  shine.addColorStop(1, "rgba(0,0,0,0.25)")
  g.fillStyle = shine
  g.fillRect(0, 0, w, h)
  g.restore()
  g.lineWidth = 4
  g.strokeStyle = "rgba(0,0,0,0.8)"
  roundRect(g, 4, 4, w - 8, h - 8, 18)
  g.stroke()
  g.lineWidth = 2
  g.strokeStyle = "rgba(255,255,255,0.14)"
  roundRect(g, 9, 9, w - 18, h - 18, 14)
  g.stroke()
  ;[[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]].forEach(([x, y]) => rivet(g, x, y, 6))
}

function rivet(g, x, y, r) {
  const grad = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r)
  grad.addColorStop(0, "#d6dbe0")
  grad.addColorStop(0.5, "#6c757d")
  grad.addColorStop(1, "#1a1f24")
  g.fillStyle = grad
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}

function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)))
  const r = f(n >> 16)
  const gg = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (gg << 8) | b).toString(16).padStart(6, "0")}`
}

function letterTexture(symbol) {
  const text = { ten: "10", jack: "J", queen: "Q", king: "K", ace: "A" }[symbol]
  const [light, mid, dark] = LETTER_COLORS[symbol]
  return canvasTexture(CELL_W * SCALE, CELL_H * SCALE, (g, w, h) => {
    steelPlate(g, w, h)
    const glow = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.55)
    glow.addColorStop(0, mid + "55")
    glow.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = glow
    g.fillRect(0, 0, w, h)
    const size = text.length > 1 ? 150 : 176
    g.font = `900 ${size}px ${FONT_STENCIL}`
    g.textAlign = "center"
    g.textBaseline = "middle"
    const cy = h / 2 + 12
    g.fillStyle = "rgba(0,0,0,0.75)"
    g.fillText(text, w / 2 + 5, cy + 7)
    const fill = g.createLinearGradient(0, cy - size / 2, 0, cy + size / 2)
    fill.addColorStop(0, light)
    fill.addColorStop(0.48, mid)
    fill.addColorStop(0.52, shade(mid, -14))
    fill.addColorStop(1, dark)
    g.lineWidth = 10
    g.strokeStyle = "#0a0d10"
    g.strokeText(text, w / 2, cy)
    g.fillStyle = fill
    g.fillText(text, w / 2, cy)
    g.lineWidth = 2
    g.strokeStyle = "rgba(255,255,255,0.45)"
    g.strokeText(text, w / 2, cy - 2)
  })
}

function portraitTexture(symbol, image) {
  const [rim, deep] = FRAME[symbol]
  const special = ["sonar", "mine", "depth", "periscope", "torpedo"].includes(symbol)
  return canvasTexture(CELL_W * SCALE, CELL_H * SCALE, (g, w, h) => {
    roundRect(g, 4, 4, w - 8, h - 8, 18)
    g.fillStyle = "#070a0d"
    g.fill()
    g.save()
    roundRect(g, 12, 12, w - 24, h - 24, 12)
    g.clip()
    if (image) {
      const scale = Math.max((w - 24) / image.width, (h - 24) / image.height) * (special ? 1.04 : 1.12)
      const iw = image.width * scale
      const ih = image.height * scale
      g.drawImage(image, (w - iw) / 2, special ? (h - ih) / 2 : 12 - ih * 0.06, iw, ih)
    }
    const vignette = g.createRadialGradient(w / 2, h * 0.42, w * 0.2, w / 2, h / 2, w * 0.7)
    vignette.addColorStop(0, "rgba(0,0,0,0)")
    vignette.addColorStop(1, "rgba(0,0,0,0.65)")
    g.fillStyle = vignette
    g.fillRect(0, 0, w, h)
    const plate = g.createLinearGradient(0, h - 62, 0, h)
    plate.addColorStop(0, "rgba(0,0,0,0)")
    plate.addColorStop(0.45, "rgba(0,0,0,0.78)")
    plate.addColorStop(1, "rgba(0,0,0,0.92)")
    g.fillStyle = plate
    g.fillRect(0, h - 70, w, 70)
    g.restore()

    const frame = g.createLinearGradient(0, 0, w, h)
    frame.addColorStop(0, shade(rim, 18))
    frame.addColorStop(0.35, rim)
    frame.addColorStop(0.65, deep)
    frame.addColorStop(1, rim)
    g.lineWidth = symbol === "captain" ? 12 : 9
    g.strokeStyle = frame
    roundRect(g, 8, 8, w - 16, h - 16, 16)
    g.stroke()
    g.lineWidth = 2
    g.strokeStyle = "rgba(0,0,0,0.85)"
    roundRect(g, 14, 14, w - 28, h - 28, 11)
    g.stroke()
    if (symbol === "captain") {
      ;[[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]].forEach(([x, y]) => {
        g.fillStyle = "#ffe7a8"
        g.beginPath()
        g.arc(x, y, 7, 0, Math.PI * 2)
        g.fill()
      })
    }

    g.font = `700 ${special ? 30 : 26}px ${FONT_STENCIL}`
    g.textAlign = "center"
    g.textBaseline = "alphabetic"
    g.lineWidth = 6
    g.strokeStyle = "rgba(0,0,0,0.9)"
    const label = LABEL[symbol]
    g.strokeText(label, w / 2, h - 24)
    g.fillStyle = special ? rim : "#f1e6cc"
    g.fillText(label, w / 2, h - 24)
    if (["mine", "depth", "periscope", "torpedo"].includes(symbol)) {
      g.font = `700 20px ${FONT_STENCIL}`
      const tag = "JOKER"
      const tw = g.measureText(tag).width + 18
      g.fillStyle = rim
      roundRect(g, w - tw - 20, 20, tw, 28, 6)
      g.fill()
      g.fillStyle = "#0b0b0b"
      g.fillText(tag, w - tw / 2 - 20, 41)
    }
  })
}

export function buildSymbolTextures(images) {
  const textures = new Map()
  for (const symbol of Object.keys(LETTER_COLORS)) textures.set(symbol, letterTexture(symbol))
  for (const symbol of Object.keys(FRAME)) textures.set(symbol, portraitTexture(symbol, images.get(symbol)))
  return textures
}

export function glowFrame(color = "#ffd66b") {
  const pad = 26
  return canvasTexture(CELL_W * SCALE + pad * 2, CELL_H * SCALE + pad * 2, (g, w, h) => {
    g.shadowColor = color
    g.shadowBlur = 28
    g.lineWidth = 10
    g.strokeStyle = color
    roundRect(g, pad, pad, w - pad * 2, h - pad * 2, 20)
    g.stroke()
    g.shadowBlur = 0
    g.lineWidth = 3
    g.strokeStyle = "#fffbe6"
    roundRect(g, pad, pad, w - pad * 2, h - pad * 2, 20)
    g.stroke()
  })
}

export function softDot(color = "#ffffff", size = 64) {
  return canvasTexture(size, size, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    grad.addColorStop(0, color)
    grad.addColorStop(0.35, color + "aa")
    grad.addColorStop(1, color + "00")
    g.fillStyle = grad
    g.fillRect(0, 0, w, w)
  })
}

export function bubbleTexture() {
  return canvasTexture(48, 48, (g, w) => {
    g.strokeStyle = "rgba(200,235,255,0.8)"
    g.lineWidth = 2.5
    g.beginPath()
    g.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = "rgba(200,235,255,0.12)"
    g.fill()
    g.fillStyle = "rgba(255,255,255,0.9)"
    g.beginPath()
    g.arc(w * 0.36, w * 0.34, 4, 0, Math.PI * 2)
    g.fill()
  })
}

export function smokeTexture() {
  return canvasTexture(128, 128, (g, w) => {
    for (let i = 0; i < 9; i++) {
      const x = w / 2 + (Math.random() - 0.5) * 40
      const y = w / 2 + (Math.random() - 0.5) * 40
      const r = 26 + Math.random() * 26
      const grad = g.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, "rgba(120,120,120,0.35)")
      grad.addColorStop(1, "rgba(60,60,60,0)")
      g.fillStyle = grad
      g.fillRect(0, 0, w, w)
    }
  })
}

export function rayTexture() {
  return canvasTexture(256, 1024, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, "rgba(255,255,255,0.55)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(w * 0.42, 0)
    g.lineTo(w * 0.58, 0)
    g.lineTo(w, h)
    g.lineTo(0, h)
    g.closePath()
    g.fill()
  })
}

export function coinTexture() {
  return canvasTexture(96, 96, (g, w) => {
    const grad = g.createRadialGradient(w * 0.38, w * 0.34, 4, w / 2, w / 2, w / 2)
    grad.addColorStop(0, "#fff4c2")
    grad.addColorStop(0.45, "#e2b04a")
    grad.addColorStop(1, "#6a4510")
    g.fillStyle = grad
    g.beginPath()
    g.arc(w / 2, w / 2, w / 2 - 3, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 4
    g.strokeStyle = "#8a5d14"
    g.beginPath()
    g.arc(w / 2, w / 2, w / 2 - 12, 0, Math.PI * 2)
    g.stroke()
    g.font = `700 42px ${FONT_TITLE}`
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillStyle = "#7a4f10"
    g.fillText("⚓", w / 2, w / 2 + 2)
  })
}

export function vignetteTexture() {
  return canvasTexture(512, 288, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h * 0.48, h * 0.25, w / 2, h / 2, w * 0.62)
    grad.addColorStop(0, "rgba(0,0,0,0)")
    grad.addColorStop(1, "rgba(0,0,0,0.88)")
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
}

export function titleTexture(text, size, opts = {}) {
  const font = `${opts.weight || 700} ${size * SCALE}px ${opts.font || FONT_TITLE}`
  const probe = document.createElement("canvas").getContext("2d")
  probe.font = font
  const spacing = (opts.spacing || 0) * SCALE
  const width = Math.ceil(probe.measureText(text).width + spacing * text.length + size * SCALE * 0.6)
  const height = Math.ceil(size * SCALE * 1.5)
  return canvasTexture(width, height, (g, w, h) => {
    g.font = font
    g.textAlign = "center"
    g.textBaseline = "middle"
    if ("letterSpacing" in g) g.letterSpacing = `${spacing}px`
    const cy = h / 2 + size * 0.06 * SCALE
    const colors = opts.colors || ["#fff3c8", "#e7b54d", "#8c5a12"]
    g.shadowColor = opts.glow || "rgba(255,180,60,0.55)"
    g.shadowBlur = 28
    g.lineWidth = size * 0.16 * SCALE
    g.strokeStyle = opts.stroke || "#1a0f04"
    g.strokeText(text, w / 2, cy)
    g.shadowBlur = 0
    const fill = g.createLinearGradient(0, cy - size * SCALE / 2, 0, cy + size * SCALE / 2)
    fill.addColorStop(0, colors[0])
    fill.addColorStop(0.5, colors[1])
    fill.addColorStop(0.55, colors[2])
    fill.addColorStop(1, colors[1])
    g.fillStyle = fill
    g.fillText(text, w / 2, cy)
    g.lineWidth = 1.5 * SCALE
    g.strokeStyle = "rgba(255,255,255,0.5)"
    g.strokeText(text, w / 2, cy - 1.5 * SCALE)
  })
}

export function panelTexture(w, h, opts = {}) {
  return canvasTexture(w * SCALE, h * SCALE, (g, cw, ch) => {
    const r = (opts.radius || 14) * SCALE
    const grad = g.createLinearGradient(0, 0, 0, ch)
    grad.addColorStop(0, opts.top || "#2b3237")
    grad.addColorStop(1, opts.bottom || "#0d1114")
    roundRect(g, 2, 2, cw - 4, ch - 4, r)
    g.fillStyle = grad
    g.fill()
    g.lineWidth = 3 * SCALE
    g.strokeStyle = opts.rim || "#8a6c3a"
    g.stroke()
    g.lineWidth = 1 * SCALE
    g.strokeStyle = "rgba(255,255,255,0.12)"
    roundRect(g, 6 * SCALE, 6 * SCALE, cw - 12 * SCALE, ch - 12 * SCALE, r * 0.7)
    g.stroke()
    if (opts.rivets !== false) {
      const inset = 12 * SCALE
      ;[[inset, inset], [cw - inset, inset], [inset, ch - inset], [cw - inset, ch - inset]].forEach(([x, y]) => rivet(g, x, y, 4 * SCALE))
    }
  })
}

export function fireButtonTexture() {
  const size = 200
  return canvasTexture(size * SCALE, size * SCALE, (g, w) => {
    const c = w / 2
    const ring = g.createLinearGradient(0, 0, w, w)
    ring.addColorStop(0, "#fff0b8")
    ring.addColorStop(0.4, "#c9973c")
    ring.addColorStop(1, "#4d300a")
    g.fillStyle = ring
    g.beginPath()
    g.arc(c, c, c - 4, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = "#120a06"
    g.beginPath()
    g.arc(c, c, c * 0.8, 0, Math.PI * 2)
    g.fill()
    const dome = g.createRadialGradient(c * 0.8, c * 0.66, 8, c, c, c * 0.76)
    dome.addColorStop(0, "#ff9a7a")
    dome.addColorStop(0.35, "#d0281c")
    dome.addColorStop(1, "#4a0806")
    g.fillStyle = dome
    g.beginPath()
    g.arc(c, c, c * 0.74, 0, Math.PI * 2)
    g.fill()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      rivet(g, c + Math.cos(a) * c * 0.9, c + Math.sin(a) * c * 0.9, 7)
    }
    g.fillStyle = "rgba(255,255,255,0.25)"
    g.beginPath()
    g.ellipse(c * 0.82, c * 0.62, c * 0.34, c * 0.16, -0.5, 0, Math.PI * 2)
    g.fill()
  })
}

export function gaugeTexture() {
  const size = 260
  return canvasTexture(size * SCALE, size * SCALE, (g, w) => {
    const c = w / 2
    const bezel = g.createLinearGradient(0, 0, w, w)
    bezel.addColorStop(0, "#fff0b8")
    bezel.addColorStop(0.45, "#b78632")
    bezel.addColorStop(1, "#3b2508")
    g.fillStyle = bezel
    g.beginPath()
    g.arc(c, c, c - 4, 0, Math.PI * 2)
    g.fill()
    const face = g.createRadialGradient(c, c * 0.8, 10, c, c, c * 0.84)
    face.addColorStop(0, "#14303a")
    face.addColorStop(1, "#04090c")
    g.fillStyle = face
    g.beginPath()
    g.arc(c, c, c * 0.84, 0, Math.PI * 2)
    g.fill()
    const start = Math.PI * 0.75
    const span = Math.PI * 1.5
    g.lineWidth = 16
    g.strokeStyle = "rgba(208,40,28,0.75)"
    g.beginPath()
    g.arc(c, c, c * 0.7, start + span * 0.72, start + span)
    g.stroke()
    for (let i = 0; i <= 30; i++) {
      const a = start + (i / 30) * span
      const major = i % 3 === 0
      g.strokeStyle = major ? "#a8f0ff" : "rgba(168,240,255,0.5)"
      g.lineWidth = major ? 5 : 2
      g.beginPath()
      g.moveTo(c + Math.cos(a) * c * 0.78, c + Math.sin(a) * c * 0.78)
      g.lineTo(c + Math.cos(a) * c * (major ? 0.64 : 0.7), c + Math.sin(a) * c * (major ? 0.64 : 0.7))
      g.stroke()
    }
    g.font = `700 30px ${FONT_STENCIL}`
    g.fillStyle = "#a8f0ff"
    g.textAlign = "center"
    g.textBaseline = "middle"
    ;["1", "4", "7", "10", "13", "16", "19", "22", "25", "28", "∞"].forEach((label, i) => {
      const a = start + (i / 10) * span
      g.fillText(label, c + Math.cos(a) * c * 0.5, c + Math.sin(a) * c * 0.5)
    })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2
      rivet(g, c + Math.cos(a) * c * 0.92, c + Math.sin(a) * c * 0.92, 8)
    }
    g.fillStyle = "rgba(255,255,255,0.08)"
    g.beginPath()
    g.ellipse(c * 0.8, c * 0.6, c * 0.5, c * 0.22, -0.6, 0, Math.PI * 2)
    g.fill()
  })
}

export function torpedoTexture() {
  return canvasTexture(320, 80, (g, w, h) => {
    const body = g.createLinearGradient(0, 0, 0, h)
    body.addColorStop(0, "#d8dde0")
    body.addColorStop(0.45, "#6f7a82")
    body.addColorStop(1, "#1e2428")
    g.fillStyle = body
    roundRect(g, 40, 18, 220, 44, 22)
    g.fill()
    const nose = g.createLinearGradient(0, 0, 0, h)
    nose.addColorStop(0, "#ffd0a0")
    nose.addColorStop(0.5, "#e0602a")
    nose.addColorStop(1, "#5a1a06")
    g.fillStyle = nose
    g.beginPath()
    g.moveTo(250, 18)
    g.quadraticCurveTo(318, 40, 250, 62)
    g.closePath()
    g.fill()
    g.fillStyle = "#c79a3a"
    g.fillRect(14, 30, 30, 20)
    g.beginPath()
    g.moveTo(44, 18)
    g.lineTo(10, 4)
    g.lineTo(26, 30)
    g.closePath()
    g.moveTo(44, 62)
    g.lineTo(10, 76)
    g.lineTo(26, 50)
    g.closePath()
    g.fill()
    g.strokeStyle = "rgba(0,0,0,0.4)"
    g.lineWidth = 2
    ;[110, 180].forEach((x) => {
      g.beginPath()
      g.moveTo(x, 19)
      g.lineTo(x, 61)
      g.stroke()
    })
  })
}

export function shipTexture() {
  return canvasTexture(600, 220, (g, w, h) => {
    g.fillStyle = "#05080b"
    g.beginPath()
    g.moveTo(20, 150)
    g.lineTo(580, 150)
    g.lineTo(540, 205)
    g.lineTo(70, 205)
    g.closePath()
    g.fill()
    g.fillRect(150, 100, 140, 52)
    g.fillRect(320, 112, 160, 40)
    g.fillRect(200, 40, 34, 64)
    g.fillRect(110, 20, 6, 132)
    g.fillRect(460, 30, 6, 122)
    g.strokeStyle = "#05080b"
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(113, 22)
    g.lineTo(463, 32)
    g.stroke()
    g.fillStyle = "rgba(255,200,120,0.55)"
    for (let i = 0; i < 6; i++) g.fillRect(170 + i * 18, 118, 6, 5)
  })
}

export const SEG_W = 140
export const SEG_H = 56

export function torpedoSegmentTexture(index) {
  return canvasTexture(SEG_W * SCALE, SEG_H * SCALE, (g, w, h) => {
    g.scale(SCALE, SCALE)
    const top = 8
    const bottom = 48
    const steel = (y0, y1) => {
      const grad = g.createLinearGradient(0, y0, 0, y1)
      grad.addColorStop(0, "#eef2f4")
      grad.addColorStop(0.18, "#b9c2c8")
      grad.addColorStop(0.55, "#5d6870")
      grad.addColorStop(1, "#161b1f")
      return grad
    }
    g.fillStyle = steel(top, bottom)
    g.beginPath()
    if (index === 0) {
      g.moveTo(16, 18)
      g.lineTo(SEG_W, top)
      g.lineTo(SEG_W, bottom)
      g.lineTo(16, 38)
      g.closePath()
      g.fill()
      g.fillStyle = "#a07a32"
      g.beginPath()
      g.moveTo(26, 19)
      g.lineTo(14, 2)
      g.lineTo(58, 2)
      g.lineTo(66, 15)
      g.closePath()
      g.moveTo(26, 37)
      g.lineTo(14, 54)
      g.lineTo(58, 54)
      g.lineTo(66, 41)
      g.closePath()
      g.fill()
      g.strokeStyle = "rgba(0,0,0,0.5)"
      g.lineWidth = 1.5
      g.stroke()
      g.fillStyle = "#3a3f44"
      g.fillRect(8, 22, 10, 12)
    } else if (index === 3) {
      g.moveTo(0, top)
      g.lineTo(60, top)
      g.bezierCurveTo(118, top, 138, 22, 138, 28)
      g.bezierCurveTo(138, 34, 118, bottom, 60, bottom)
      g.lineTo(0, bottom)
      g.closePath()
      g.fill()
      const tip = g.createLinearGradient(0, top, 0, bottom)
      tip.addColorStop(0, "#ffd2a6")
      tip.addColorStop(0.45, "#d8481c")
      tip.addColorStop(1, "#4a1004")
      g.fillStyle = tip
      g.beginPath()
      g.moveTo(96, 13)
      g.bezierCurveTo(126, 18, 138, 24, 138, 28)
      g.bezierCurveTo(138, 32, 126, 38, 96, 43)
      g.closePath()
      g.fill()
    } else {
      g.rect(0, top, SEG_W, bottom - top)
      g.fill()
    }
    if (index === 1) {
      g.fillStyle = "rgba(10,14,18,0.55)"
      g.fillRect(28, top, 8, bottom - top)
      g.fillRect(104, top, 8, bottom - top)
      g.fillStyle = "rgba(255,255,255,0.55)"
      for (let x = 48; x < 100; x += 12) {
        g.beginPath()
        g.arc(x, 14, 1.6, 0, Math.PI * 2)
        g.arc(x, 42, 1.6, 0, Math.PI * 2)
        g.fill()
      }
    }
    if (index === 2) {
      g.save()
      g.beginPath()
      g.rect(34, top, 72, bottom - top)
      g.clip()
      g.fillStyle = "#e7b52c"
      g.fillRect(34, top, 72, bottom - top)
      g.fillStyle = "#151515"
      for (let x = 10; x < 130; x += 16) {
        g.beginPath()
        g.moveTo(x, bottom)
        g.lineTo(x + 8, bottom)
        g.lineTo(x + 28, top)
        g.lineTo(x + 20, top)
        g.closePath()
        g.fill()
      }
      const shine = g.createLinearGradient(0, top, 0, bottom)
      shine.addColorStop(0, "rgba(255,255,255,0.45)")
      shine.addColorStop(0.3, "rgba(255,255,255,0)")
      shine.addColorStop(1, "rgba(0,0,0,0.5)")
      g.fillStyle = shine
      g.fillRect(34, top, 72, bottom - top)
      g.restore()
    }
    g.strokeStyle = "rgba(0,0,0,0.55)"
    g.lineWidth = 1.5
    if (index !== 0) {
      g.beginPath()
      g.moveTo(1, top)
      g.lineTo(1, bottom)
      g.stroke()
    }
  })
}
