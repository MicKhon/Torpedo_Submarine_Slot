import {
  Application, BlurFilter, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture,
} from "pixi.js"
import gsap from "gsap"
import { MAX_ROWS, PAYING, PAYS, TITLES, createEngine, displayedWays, freshTubes } from "./engine.js"
import { createAudio } from "./audio.js"
import * as art from "./art.js"

const W = 1600
const H = 900
const CELL_W = art.CELL_W
const CELL_H = art.CELL_H
const GAP = 8
const REEL_GAP = 14
const REEL_MAX_H = 4 * CELL_H + 3 * GAP
const REELS_TOP = 172
const REEL_BLOCK_W = 6 * CELL_W + 5 * REEL_GAP
const REELS_LEFT = (W - REEL_BLOCK_W) / 2
const HOUSING_PAD_X = 15
const HOUSING_W = REEL_BLOCK_W + HOUSING_PAD_X * 2
const HOUSING_X = REELS_LEFT - HOUSING_PAD_X
const HOUSING_H = REEL_MAX_H + 72
const BUY = { hunter: 90, pack: 150 }
const BETS = [1, 2, 5, 10, 20, 40, 50, 100]
const MAX_MULTIPLE = 36000
const FONT = "DIN Condensed, DIN Alternate, Impact, Arial Narrow, sans-serif"
const SERIF = "Copperplate, Big Caslon, serif"
const INK = 0xf1e6cc
const BRASS = 0xe2b04a
const RED = 0xd0281c
const SONAR_GREEN = 0x5dff9a
const SEG_W = art.SEG_W
const SEG_H = art.SEG_H
const BOARD_BOTTOM = REELS_TOP + REEL_MAX_H
const BAY_X = HOUSING_X
const BAY_W = HOUSING_W
const BAY_LIP = BOARD_BOTTOM + 36
const BAY_TOP = BAY_LIP + 10
const BAY_H = 78
const BAY_TRAVEL = BAY_H + 22
const BOARD_PIVOT_Y = BAY_LIP + 8
const PACK_SCALE = 0.9
const BAY_SCREEN_LIMIT = 768
const TOP_LIMIT = 76
let area = { top: REELS_TOP, height: REEL_MAX_H, rows: 4 }
const VOX = ["nein", "neinx3", "los", "treffer", "versenkt", "alarm", "feuer", "rohre", "jawohl", "wasser"]
const SHOUTS = { launch: "rohre", hit: "treffer", big: "treffer", huge: "versenkt", hunter: "alarm", pack: "alarm", cheat: "jawohl", mine: "wasser" }

const BARK = {
  loss: ["Nein!", "Nichts.", "Daneben.", "Kein Kontakt.", "Nur Wasser.", "Pech gehabt.", "Leerschlag."],
  small: ["Treffer.", "Gut so.", "Na also.", "Weiter so."],
  mid: ["Guter Schuss!", "Mitten hinein!", "Sauberer Treffer!"],
  big: ["Volltreffer!", "Ausgezeichnet!", "Versenkt!"],
  huge: ["Alarm! Gold in Sicht!", "Unglaublich! Volltreffer!"],
  launch: ["Torpedo los!", "Rohr frei — los!", "Alle Rohre — los!"],
  hit: ["Einschlag!", "Volltreffer!", "Getroffen!"],
  miss: ["Fehlschuss!", "Vorbei!", "Nein, daneben!"],
  hunter: ["Alarm! Leise Jagd!", "Sehrohr ausfahren!"],
  pack: ["Rudeltaktik!", "Die Wölfe laden die Rohre!"],
  mine: ["Mine! Deckung!", "Achtung, Mine!"],
  depth: ["Tiefe nachsteuern!", "Trimmung halten!"],
  sonar: ["Sonar-Kontakt!", "Echo im Wasser!"],
  current: ["Strömung!", "Starke Strömung!"],
  expand: ["Feld erweitert!", "Mehr Raum im Boot!", "Schotten auf!"],
  spin: ["Klar zum Gefecht.", "Volle Fahrt voraus.", "Gefechtsstationen.", "Auf Tauchstation."],
  broke: ["Nicht genug Guthaben.", "Nein. Die Kasse ist leer."],
  cheat: ["Nachschub an Bord.", "Gut. Weiterfahren."],
  end: ["Jagd beendet.", "Auftauchen!"],
  idle: ["Gefechtsstationen.", "Alles ruhig im Boot.", "Horcher meldet nichts."],
}

function stored(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

const state = {
  balance: Number(stored("ub.balance") || 10000),
  bet: Number(stored("ub.bet") || 10),
  mode: "base",
  freeSpins: 0,
  sticky: 0,
  tubes: freshTubes(),
  roundWin: 0,
  spinWin: 0,
  roundBet: 10,
  busy: false,
  skip: false,
  music: stored("ub.music") !== "0",
  sfx: stored("ub.sfx") !== "0",
  voice: stored("ub.voice") !== "0",
  turbo: stored("ub.turbo") === "1",
  autoplay: 0,
  grid: null,
  multiplier: 1,
  heights: null,
}
if (!BETS.includes(state.bet)) state.bet = 10
if (!Number.isFinite(state.balance)) state.balance = 10000

const engine = createEngine()
const audio = createAudio(state)
state.grid = engine.attract("base")

let app
let world
let bgLayer
let reelsLayer
let fxLayer
let cineLayer
let overlayLayer
let symbolTextures
let textures = {}
const images = new Map()
const reels = []
const ui = {}
let particles
let overlaySkip = null

function save() {
  try {
    localStorage.setItem("ub.balance", String(state.balance))
    localStorage.setItem("ub.bet", String(state.bet))
    localStorage.setItem("ub.music", state.music ? "1" : "0")
    localStorage.setItem("ub.sfx", state.sfx ? "1" : "0")
    localStorage.setItem("ub.voice", state.voice ? "1" : "0")
    localStorage.setItem("ub.turbo", state.turbo ? "1" : "0")
  } catch { /* storage can be unavailable */ }
}

const money = (value) => Math.round(value).toLocaleString("de-DE")
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const wait = (seconds) => new Promise((resolve) => gsap.delayedCall(seconds, resolve))
const tween = (target, vars) => new Promise((resolve) => gsap.to(target, { ...vars, onComplete: resolve }))
const reelX = (index) => REELS_LEFT + index * (CELL_W + REEL_GAP)

function baseSpeed() {
  return state.turbo ? 1.8 : 1
}

function setSpeed() {
  gsap.globalTimeline.timeScale(state.skip ? 7 : baseSpeed())
}

function txt(text, size, color = INK, opts = {}) {
  const style = {
    fontFamily: opts.font || FONT,
    fontSize: size,
    fill: color,
    fontWeight: opts.weight || "700",
    letterSpacing: opts.spacing ?? 1,
    align: "center",
  }
  if (opts.stroke !== false) style.stroke = { color: opts.strokeColor ?? 0x000000, width: opts.strokeWidth ?? Math.max(2, size * 0.09), join: "round" }
  if (opts.shadow !== false) style.dropShadow = { color: 0x000000, alpha: 0.8, blur: opts.blur ?? 4, distance: 2, angle: Math.PI / 2 }
  const node = new Text({ text, style: new TextStyle(style) })
  node.anchor.set(opts.ax ?? 0.5, opts.ay ?? 0.5)
  return node
}

function loadImage(name) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = `${name}.jpg`
  })
}

function sized(texture, width, height) {
  const sprite = new Sprite(texture)
  sprite.width = width
  sprite.height = height
  return sprite
}

class Particles {
  constructor(layer) {
    this.layer = layer
    this.items = []
  }

  emit(texture, x, y, opts = {}) {
    const count = opts.count || 10
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.x = x + (Math.random() - 0.5) * (opts.spreadX || 0)
      sprite.y = y + (Math.random() - 0.5) * (opts.spreadY || 0)
      const angle = (opts.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (opts.cone ?? Math.PI * 2)
      const speed = (opts.speed || 200) * (0.4 + Math.random() * 0.9)
      const scale = (opts.scale || 0.5) * (0.6 + Math.random() * 0.8)
      sprite.scale.set(scale)
      sprite.alpha = opts.alpha ?? 1
      if (opts.tint !== undefined) sprite.tint = Array.isArray(opts.tint) ? pick(opts.tint) : opts.tint
      if (opts.blend) sprite.blendMode = opts.blend
      sprite.rotation = Math.random() * Math.PI * 2
      this.layer.addChild(sprite)
      this.items.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: (opts.life || 1) * (0.6 + Math.random() * 0.6),
        age: 0,
        gravity: opts.gravity ?? 300,
        drag: opts.drag ?? 0.98,
        grow: opts.grow ?? 0,
        spin: (Math.random() - 0.5) * (opts.spin ?? 4),
        alpha: sprite.alpha,
        wobble: opts.wobble || 0,
        seed: Math.random() * 10,
      })
    }
  }

  update(dt) {
    this.items = this.items.filter((p) => {
      p.age += dt
      const t = p.age / p.life
      if (t >= 1) {
        p.sprite.destroy()
        return false
      }
      p.vy += p.gravity * dt
      p.vx *= p.drag
      p.vy *= p.drag
      p.sprite.x += p.vx * dt + (p.wobble ? Math.sin(p.age * 6 + p.seed) * p.wobble * dt : 0)
      p.sprite.y += p.vy * dt
      p.sprite.rotation += p.spin * dt
      if (p.grow) p.sprite.scale.set(p.sprite.scale.x * (1 + p.grow * dt))
      p.sprite.alpha = p.alpha * (1 - t * t)
      return true
    })
  }
}

function sparks(x, y, count = 24, tint = [0xffd27a, 0xffffff, 0xff9a40]) {
  particles.emit(textures.dot, x, y, { count, speed: 520, scale: 0.28, life: 0.7, gravity: 600, blend: "add", tint })
}

function bubbles(x, y, count = 10, spread = 60) {
  particles.emit(textures.bubble, x, y, {
    count, speed: 90, angle: -Math.PI / 2, cone: 1.2, scale: 0.42, life: 1.6, gravity: -160, spreadX: spread, spreadY: spread * 0.5, wobble: 50, alpha: 0.9,
  })
}

function explosion(x, y, size = 1) {
  const flash = new Sprite(textures.flare)
  flash.anchor.set(0.5)
  flash.x = x
  flash.y = y
  flash.blendMode = "add"
  flash.scale.set(0.2)
  fxLayer.addChild(flash)
  gsap.to(flash.scale, { x: 5 * size, y: 5 * size, duration: 0.35, ease: "power2.out" })
  gsap.to(flash, { alpha: 0, duration: 0.5, delay: 0.1, onComplete: () => flash.destroy() })
  const ring = new Graphics().circle(0, 0, 40).stroke({ width: 10, color: 0xffd9a0, alpha: 0.9 })
  ring.x = x
  ring.y = y
  fxLayer.addChild(ring)
  gsap.to(ring.scale, { x: 6 * size, y: 6 * size, duration: 0.6, ease: "power2.out" })
  gsap.to(ring, { alpha: 0, duration: 0.6, onComplete: () => ring.destroy() })
  particles.emit(textures.fire, x, y, { count: 26 * size, speed: 420 * size, scale: 0.8, life: 0.8, gravity: -60, blend: "add", grow: 0.6, tint: [0xffb347, 0xff6a1a, 0xffe08a] })
  particles.emit(textures.smoke, x, y, { count: 12 * size, speed: 140, scale: 1.1, life: 2.2, gravity: -40, grow: 0.5, alpha: 0.7, spin: 1 })
  sparks(x, y, 30 * size)
  bubbles(x, y, 14 * size, 100)
}

async function shake(power = 10, seconds = 0.4) {
  const origin = { x: world.x, y: world.y }
  const proxy = { t: 0 }
  await tween(proxy, {
    t: 1,
    duration: seconds,
    ease: "none",
    onUpdate: () => {
      const amp = power * (1 - proxy.t) * world.scale.x
      world.x = origin.x + (Math.random() - 0.5) * amp * 2
      world.y = origin.y + (Math.random() - 0.5) * amp * 1.4
    },
  })
  world.x = origin.x
  world.y = origin.y
}

function screenFlash(color = 0xffffff, alpha = 0.7, seconds = 0.4) {
  const flash = new Graphics().rect(0, 0, W, H).fill({ color })
  flash.alpha = alpha
  overlayLayer.addChild(flash)
  gsap.to(flash, { alpha: 0, duration: seconds, onComplete: () => flash.destroy() })
}

class ReelView {
  constructor(index) {
    this.index = index
    this.root = new Container()
    this.root.x = reelX(index)
    this.back = new Graphics()
    this.glowBack = new Graphics()
    this.body = new Container()
    this.maskG = new Graphics()
    this.strip = new Container()
    this.fx = new Container()
    this.body.addChild(this.strip)
    this.body.mask = this.maskG
    this.root.addChild(this.glowBack, this.back, this.body, this.maskG, this.fx)
    this.blur = new BlurFilter({ strength: 0, quality: 3 })
    this.blur.strengthX = 0
    this.views = []
    this.rows = 0
    this.cellH = CELL_H
    this.glows = []
  }

  layout(rows, animate = false) {
    this.rows = rows
    this.cellH = CELL_H
    this.height = rows * this.cellH + (rows - 1) * GAP
    const y = this.targetY()
    gsap.killTweensOf(this.root)
    if (animate && Math.abs(this.root.y - y) > 1) gsap.to(this.root, { y, duration: 0.5, ease: "power2.inOut" })
    else this.root.y = y
    this.back.clear()
    this.back.roundRect(-9, -9, CELL_W + 18, this.height + 18, 16).fill({ color: 0x03070a, alpha: 0.92 }).stroke({ width: 3, color: 0xb08a48 })
    this.back.roundRect(-4, -4, CELL_W + 8, this.height + 8, 12).stroke({ width: 1, color: 0xffffff, alpha: 0.12 })
    this.maskG.clear()
    this.maskG.rect(-4, -4, CELL_W + 8, this.height + 8).fill(0xffffff)
  }

  targetY() {
    return area.top + (area.height - this.height) / 2
  }

  recenter() {
    const y = this.targetY()
    if (Math.abs(this.root.y - y) > 1) gsap.to(this.root, { y, duration: 0.5, ease: "power2.inOut" })
  }

  step() {
    return this.cellH + GAP
  }

  makeView(item) {
    const view = new Container()
    const sprite = new Sprite(symbolTextures.get(item.symbol) || symbolTextures.get("ten"))
    const s = this.cellH / CELL_H
    sprite.anchor.set(0.5)
    sprite.width = CELL_W * s
    sprite.height = this.cellH
    sprite.x = CELL_W / 2
    sprite.y = this.cellH / 2
    view.addChild(sprite)
    view.sprite = sprite
    view.baseScale = sprite.scale.x
    view.item = item
    if (item.ways > 1) {
      const badge = new Container()
      const disc = new Graphics().circle(0, 0, 22).fill({ color: RED }).stroke({ width: 3, color: 0xffe2a0 })
      badge.addChild(disc, txt(`×${item.ways}`, 24, 0xffffff, { strokeWidth: 3 }))
      badge.x = CELL_W - 24
      badge.y = 24
      badge.scale.set(Math.max(0.6, s))
      view.addChild(badge)
      view.badge = badge
    }
    if (item.depthMultiplier > 1) {
      const label = txt(`×${item.depthMultiplier}`, Math.max(22, 40 * s), 0x9ff4ff, { strokeWidth: 5 })
      label.x = CELL_W / 2
      label.y = this.cellH / 2
      view.addChild(label)
    }
    if (item.reelStack && item.ways === 0) sprite.alpha = 0.9
    return view
  }

  setCells(items) {
    this.clearGlow()
    this.layout(items.length)
    this.strip.removeChildren().forEach((child) => child.destroy({ children: true }))
    this.strip.y = 0
    this.views = items.map((item, row) => {
      const view = this.makeView(item)
      view.y = row * this.step()
      this.strip.addChild(view)
      return view
    })
  }

  cellCenter(row) {
    return toWorld(this.root.x + CELL_W / 2, this.targetY() + row * this.step() + this.cellH / 2)
  }

  anticipate(on) {
    gsap.killTweensOf(this.glowBack)
    this.glowBack.clear()
    if (!on) return
    this.glowBack.roundRect(-16, -16, CELL_W + 32, this.height + 32, 20).stroke({ width: 10, color: SONAR_GREEN, alpha: 0.9 })
    this.glowBack.alpha = 0.3
    gsap.to(this.glowBack, { alpha: 1, duration: 0.25, yoyo: true, repeat: -1 })
  }

  async spinTo(items, opts) {
    this.clearGlow()
    const oldViews = this.views
    const oldStep = this.step()
    this.layout(items.length, true)
    const step = this.step()
    oldViews.forEach((view, row) => {
      view.y = row * oldStep
    })
    const fillers = Math.max(4, Math.round(opts.cruise * 24))
    const travel = (items.length + fillers) * step
    const fresh = items.map((item, row) => {
      const view = this.makeView(item)
      view.y = row * step - travel
      this.strip.addChild(view)
      return view
    })
    const extras = []
    for (let i = -1; i < fillers; i++) {
      const view = this.makeView({ symbol: fillerSymbol(), ways: 1 })
      view.y = i < 0 ? -travel - step : (items.length + i) * step - travel
      this.strip.addChild(view)
      extras.push(view)
    }
    await wait(opts.delay)
    this.strip.filters = [this.blur]
    const tl = gsap.timeline()
    tl.to(this.strip, { y: -22, duration: 0.11, ease: "power2.out" })
    tl.to(this.blur, { strengthY: 16, duration: 0.15 }, "<0.06")
    tl.to(this.strip, { y: travel * 0.18, duration: 0.18, ease: "power2.in" })
    if (opts.anticipate) {
      tl.to(this.strip, { y: travel * 0.6, duration: opts.cruise * 0.55, ease: "none" })
      tl.call(() => {
        this.anticipate(true)
        audio.sfx.tension()
      })
      tl.to(this.strip, { y: travel + 26, duration: opts.cruise * 0.45 + 1.15, ease: "power2.out" })
    } else {
      tl.to(this.strip, { y: travel + 26, duration: opts.cruise, ease: "none" })
    }
    tl.to(this.blur, { strengthY: 0, duration: 0.12 }, "-=0.12")
    tl.to(this.strip, { y: travel, duration: 0.24, ease: "back.out(3)" })
    let lastCell = 0
    tl.eventCallback("onUpdate", () => {
      const cell = Math.floor(this.strip.y / step)
      if (cell !== lastCell && this.index % 2 === 0) audio.sfx.reelTick(0.6)
      lastCell = cell
    })
    await new Promise((resolve) => tl.eventCallback("onComplete", resolve))
    this.anticipate(false)
    this.strip.filters = null
    oldViews.concat(extras).forEach((view) => view.destroy({ children: true }))
    fresh.forEach((view, row) => {
      view.y = row * step
    })
    this.strip.y = 0
    this.views = fresh
    audio.sfx.stop(this.index)
    fresh.forEach((view) => {
      gsap.fromTo(view.sprite.scale, { y: view.baseScale * 0.9 }, { y: view.baseScale, duration: 0.3, ease: "elastic.out(1, 0.4)" })
    })
  }

  highlight(rows) {
    this.views.forEach((view, row) => {
      const on = rows.has(row)
      gsap.to(view, { alpha: on ? 1 : 0.28, duration: 0.2 })
      if (!on) return
      const glow = new Sprite(textures.glow)
      glow.anchor.set(0.5)
      const s = this.cellH / CELL_H
      glow.width = (CELL_W + 26) * s + 18
      glow.height = this.cellH + 30
      glow.x = CELL_W / 2
      glow.y = row * this.step() + this.cellH / 2
      glow.blendMode = "add"
      glow.alpha = 0
      this.fx.addChild(glow)
      this.glows.push(glow)
      gsap.to(glow, { alpha: 1, duration: 0.18 })
      gsap.to(glow, { alpha: 0.45, duration: 0.35, yoyo: true, repeat: -1, delay: 0.18 })
      gsap.to(view.sprite.scale, { x: view.baseScale * 1.12, y: view.baseScale * 1.12, duration: 0.16, yoyo: true, repeat: 3, ease: "sine.inOut" })
      if (PAYING.indexOf(view.item.symbol) >= 5) {
        gsap.fromTo(view.sprite, { rotation: -0.07 }, { rotation: 0.07, duration: 0.09, yoyo: true, repeat: 5, ease: "sine.inOut", onComplete: () => { view.sprite.rotation = 0 } })
      }
      const shine = new Sprite(textures.ray)
      shine.anchor.set(0.5)
      shine.width = 46
      shine.height = this.cellH * 1.1
      shine.rotation = 0.35
      shine.blendMode = "add"
      shine.alpha = 0.7
      shine.x = -30
      shine.y = this.cellH / 2
      view.addChild(shine)
      gsap.to(shine, { x: CELL_W + 30, duration: 0.55, delay: 0.1 + row * 0.04, ease: "power2.inOut", onComplete: () => shine.destroy() })
    })
  }

  clearGlow() {
    this.glows.forEach((glow) => {
      gsap.killTweensOf(glow)
      glow.destroy()
    })
    this.glows = []
    this.views.forEach((view) => {
      gsap.killTweensOf(view)
      view.alpha = 1
    })
  }

  async regrow(items) {
    const oldY = this.root.y
    this.setCells(items)
    const newY = this.root.y
    this.root.y = oldY
    gsap.to(this.root, { y: newY, duration: 0.45, ease: "back.out(1.6)" })
    gsap.fromTo(this.back, { alpha: 0.3 }, { alpha: 1, duration: 0.4 })
    this.views.forEach((view, row) => {
      view.alpha = 0
      gsap.to(view, { alpha: 1, duration: 0.25, delay: row * 0.05 })
      gsap.fromTo(view.sprite.scale, { x: view.baseScale * 0.2, y: view.baseScale * 0.2 }, { x: view.baseScale, y: view.baseScale, duration: 0.45, delay: row * 0.05, ease: "back.out(2.4)" })
    })
    this.anticipate(true)
    await wait(0.5 + items.length * 0.05)
    this.anticipate(false)
  }

  async cascade(items) {
    this.clearGlow()
    if (items.length !== this.rows) {
      await this.regrow(items)
      return
    }
    this.recenter()
    const step = this.step()
    const keep = new Set(items.map((item) => item.id))
    const byId = new Map(this.views.map((view) => [view.item.id, view]))
    const removed = this.views.filter((view) => !keep.has(view.item.id))
    removed.forEach((view, order) => {
      const center = this.cellCenter(this.views.indexOf(view))
      gsap.delayedCall(order * 0.04, () => {
        sparks(center.x, center.y, 12)
        bubbles(center.x, center.y, 5, 50)
      })
      gsap.to(view.sprite.scale, { x: view.baseScale * 1.35, y: view.baseScale * 1.35, duration: 0.2, delay: order * 0.04, ease: "power2.out" })
      gsap.to(view, { alpha: 0, duration: 0.22, delay: order * 0.04 + 0.06 })
    })
    if (removed.length) {
      audio.sfx.pop(removed.length % 3)
      await wait(0.32 + removed.length * 0.04)
    }
    removed.forEach((view) => view.destroy({ children: true }))
    const freshCount = items.filter((item) => !byId.has(item.id)).length
    const jobs = []
    this.views = items.map((item, row) => {
      let view = byId.get(item.id)
      if (!view) {
        view = this.makeView(item)
        view.y = (row - freshCount) * step - 40
        this.strip.addChild(view)
      }
      view.item = item
      const target = row * step
      if (Math.abs(view.y - target) > 0.5) {
        jobs.push(tween(view, { y: target, duration: 0.42, delay: (items.length - row) * 0.025, ease: "bounce.out" }))
      }
      return view
    })
    await Promise.all(jobs)
    if (jobs.length) audio.sfx.land()
  }

  async nudge(items, steps) {
    this.clearGlow()
    const step = this.step()
    const fromAbove = this.views[0] && this.views[0].item.symbol === "depth"
    const sign = fromAbove ? -1 : 1
    const leftovers = []
    this.views.forEach((view, row) => {
      view.y = row * step - sign * steps * step
      leftovers.push(view)
    })
    this.views = items.map((item, row) => {
      const view = this.makeView(item)
      view.y = row * step
      this.strip.addChild(view)
      return view
    })
    this.strip.y = sign * steps * step
    for (let i = steps - 1; i >= 0; i--) {
      await tween(this.strip, { y: sign * i * step, duration: 0.24, ease: "back.out(2.2)" })
      audio.sfx.clank()
      shake(5, 0.18)
    }
    leftovers.forEach((view) => view.destroy({ children: true }))
  }

  async transform(items, color = 0xffffff) {
    const flash = new Graphics().rect(-6, -6, CELL_W + 12, this.height + 12).fill({ color })
    flash.alpha = 0
    this.fx.addChild(flash)
    await tween(flash, { alpha: 0.95, duration: 0.14 })
    this.setCells(items)
    this.fx.addChild(flash)
    this.views.forEach((view, row) => {
      gsap.fromTo(view.sprite.scale, { x: view.baseScale * 0.4, y: view.baseScale * 0.4 }, { x: view.baseScale, y: view.baseScale, duration: 0.5, delay: row * 0.04, ease: "back.out(2)" })
    })
    await tween(flash, { alpha: 0, duration: 0.35 })
    flash.destroy()
  }
}

function fillerSymbol() {
  const roll = Math.random()
  if (roll < 0.04) return "sonar"
  if (roll < 0.07) return state.mode === "pack" ? "torpedo" : "mine"
  return PAYING[Math.floor(Math.random() * PAYING.length)]
}

function showGrid(grid) {
  fitBoard(grid.map((column) => column.length))
  grid.forEach((column, reel) => reels[reel].setCells(column))
  state.grid = grid
  updateWays(grid)
}

function makeButton(label, width, height, onTap, opts = {}) {
  const root = new Container()
  const plate = sized(art.panelTexture(width, height, {
    radius: 10, rivets: false, top: opts.top || "#3b3324", bottom: opts.bottom || "#120d07", rim: opts.rim || "#c9a157",
  }), width, height)
  const caption = txt(label, opts.size || 22, opts.color ?? BRASS, { strokeWidth: 3 })
  caption.x = width / 2
  caption.y = height / 2 + 2
  root.addChild(plate, caption)
  root.caption = caption
  root.plate = plate
  root.eventMode = "static"
  root.cursor = "pointer"
  root.hitArea = new Rectangle(0, 0, width, height)
  root.pivot.set(width / 2, height / 2)
  root.on("pointerover", () => { plate.tint = 0xfff2d0 })
  root.on("pointerout", () => { plate.tint = 0xffffff })
  root.on("pointerdown", () => gsap.to(root.scale, { x: 0.94, y: 0.94, duration: 0.06 }))
  root.on("pointerup", () => gsap.to(root.scale, { x: 1, y: 1, duration: 0.2, ease: "back.out(3)" }))
  root.on("pointerupoutside", () => gsap.to(root.scale, { x: 1, y: 1, duration: 0.2 }))
  root.on("pointertap", () => {
    audio.unlock()
    audio.sfx.click()
    onTap()
  })
  return root
}

function buildBackground() {
  bgLayer = new Container()
  app.stage.addChild(bgLayer)
  ui.bg = {}
  for (const [key, name] of [["base", "uboat-bg"], ["hunter", "bg-hunter"], ["pack", "bg-pack"]]) {
    const image = images.get(name)
    const sprite = new Sprite(image ? Texture.from(image) : Texture.WHITE)
    sprite.anchor.set(0.5)
    sprite.alpha = key === "base" ? 1 : 0
    bgLayer.addChild(sprite)
    ui.bg[key] = sprite
  }
  ui.bgShade = new Graphics()
  bgLayer.addChild(ui.bgShade)
  ui.vignette = new Sprite(textures.vignette)
  bgLayer.addChild(ui.vignette)
}

function setBackground(mode) {
  for (const key of Object.keys(ui.bg)) gsap.to(ui.bg[key], { alpha: key === mode ? 1 : 0, duration: 1.2 })
  audio.setMode(mode)
}

function buildWorld() {
  world = new Container()
  app.stage.addChild(world)

  const ambient = new Container()
  world.addChild(ambient)
  ui.rays = []
  for (let i = 0; i < 5; i++) {
    const ray = new Sprite(textures.ray)
    ray.anchor.set(0.5, 0)
    ray.x = 260 + i * 270
    ray.y = -40
    ray.rotation = -0.25 + i * 0.12
    ray.scale.set(1.4, 1.1)
    ray.alpha = 0.06
    ray.blendMode = "add"
    ray.tint = 0x9fd8ff
    ambient.addChild(ray)
    ui.rays.push(ray)
    gsap.to(ray, { alpha: 0.13, rotation: ray.rotation + 0.06, duration: 3 + i * 0.7, yoyo: true, repeat: -1, ease: "sine.inOut" })
  }
  ui.alarm = new Sprite(textures.redGlow)
  ui.alarm.anchor.set(0.5)
  ui.alarm.x = W - 90
  ui.alarm.y = 70
  ui.alarm.scale.set(4)
  ui.alarm.blendMode = "add"
  ui.alarm.alpha = 0.25
  ambient.addChild(ui.alarm)
  gsap.to(ui.alarm, { alpha: 0.55, duration: 1.1, yoyo: true, repeat: -1, ease: "sine.inOut" })

  ui.board = new Container()
  ui.board.pivot.set(W / 2, BOARD_PIVOT_Y)
  ui.board.position.set(W / 2, BOARD_PIVOT_Y)
  world.addChild(ui.board)
  ui.housing = sized(housingTexture(HOUSING_H), HOUSING_W, HOUSING_H)
  ui.housing.x = HOUSING_X
  ui.housing.y = REELS_TOP - 36
  ui.housing.alpha = 0.94
  ui.housing.panelHeight = HOUSING_H
  ui.board.addChild(ui.housing)
  ui.housingGlow = new Graphics()
  ui.housingGlow.blendMode = "add"
  ui.housingGlow.alpha = 0
  ui.board.addChild(ui.housingGlow)
  drawHousingGlow()

  reelsLayer = new Container()
  ui.board.addChild(reelsLayer)
  for (let i = 0; i < 6; i++) {
    const reel = new ReelView(i)
    reels.push(reel)
    reelsLayer.addChild(reel.root)
  }

  buildLogo()
  buildGauge()
  buildSonarPanel()
  buildTubes()
  buildHud()
  buildCrew()

  cineLayer = new Container()
  world.addChild(cineLayer)
  overlayLayer = new Container()
  world.addChild(overlayLayer)
  fxLayer = new Container()
  world.addChild(fxLayer)
  particles = new Particles(fxLayer)

  ui.winPop = txt("", 84, 0xffe7a0, { font: SERIF, strokeWidth: 8, blur: 10 })
  ui.winPop.x = W / 2
  ui.winPop.y = REELS_TOP + REEL_MAX_H / 2
  ui.winPop.alpha = 0
  world.addChildAt(ui.winPop, world.getChildIndex(cineLayer))
}

function housingTexture(height) {
  return art.panelTexture(HOUSING_W, height, { radius: 26, top: "#1e252b", bottom: "#07090b", rim: "#9a7a40" })
}

function drawHousingGlow() {
  const top = area.top - 36
  const height = area.height + 72
  ui.housingGlow.clear()
  ui.housingGlow.roundRect(HOUSING_X - 4, top - 4, HOUSING_W + 8, height + 8, 28).stroke({ width: 10, color: 0xffffff, alpha: 0.9 })
  ui.housingGlow.roundRect(HOUSING_X - 12, top - 12, HOUSING_W + 24, height + 24, 34).stroke({ width: 8, color: 0xffffff, alpha: 0.35 })
}

function toWorld(x, y) {
  const board = ui.board
  return { x: board.x + (x - board.pivot.x) * board.scale.x, y: board.y + (y - board.pivot.y) * board.scale.y }
}

function boardCenter() {
  return toWorld(W / 2, area.top + area.height / 2)
}

function fitBoard(rowsList, instant = false) {
  const rows = Math.max(4, ...rowsList)
  const height = rows * CELL_H + (rows - 1) * GAP
  area = { top: BOARD_BOTTOM - height, height, rows }
  const housingTop = area.top - 36
  const housingHeight = area.height + 72
  const expanded = rows > 4
  const duration = instant ? 0 : 0.6
  const housing = ui.housing
  if (housing.panelHeight !== housingHeight) {
    const shown = housing.height
    housing.texture = housingTexture(housingHeight)
    housing.width = HOUSING_W
    housing.height = shown
    housing.panelHeight = housingHeight
    if (!instant) audio.sfx.hydraulic(0.7)
  }
  gsap.to(housing, { y: housingTop, height: housingHeight, duration, ease: "power2.inOut" })
  drawHousingGlow()
  applyBoardFrame(instant)
  gsap.to(ui.logoGroup, { alpha: expanded ? 0 : 1, duration })
  gsap.to(ui.barkGroup, { y: expanded ? -88 : 0, duration, ease: "power2.inOut" })
  return expanded
}

function applyBoardFrame(instant = false) {
  const housingTop = area.top - 36
  const expanded = area.rows > 4
  const room = BOARD_PIVOT_Y - (expanded ? TOP_LIMIT : 0)
  const fit = Math.min(1, room / (BOARD_PIVOT_Y - housingTop))
  const open = !!ui.launcherOpen
  const scale = open ? Math.min(fit, PACK_SCALE) : fit
  const bayBottom = BAY_TOP + BAY_H
  const lifted = BAY_SCREEN_LIMIT - (bayBottom - BOARD_PIVOT_Y) * scale
  const posY = open ? Math.min(BOARD_PIVOT_Y, lifted) : BOARD_PIVOT_Y
  const duration = instant ? 0 : 0.7
  gsap.to(ui.board.scale, { x: scale, y: scale, duration, ease: "power2.inOut" })
  gsap.to(ui.board, { y: posY, duration, ease: "power2.inOut" })
}

function buildLogo() {
  ui.logoGroup = new Container()
  ui.barkGroup = new Container()
  world.addChild(ui.logoGroup, ui.barkGroup)
  const logo = new Sprite(art.titleTexture("TORPEDO X STRIKE", 42, { spacing: 4 }))
  logo.anchor.set(0.5)
  logo.scale.set(0.5)
  logo.x = W / 2
  logo.y = 50
  ui.logoGroup.addChild(logo)
  ui.logo = logo
  gsap.to(logo, { y: 54, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut" })
  const sub = txt("TIEFSEE  ·  NUR SPIELGELD", 16, 0x9fb7c4, { stroke: false })
  sub.x = W / 2
  sub.y = 94
  ui.logoGroup.addChild(sub)

  const strip = sized(art.panelTexture(720, 44, { radius: 8, rivets: false, top: "#141a1e", bottom: "#05080a", rim: "#6f5a30" }), 720, 44)
  strip.x = W / 2 - 360
  strip.y = 112
  ui.barkGroup.addChild(strip)
  ui.bark = txt("Gefechtsstationen.", 30, 0xf4efe4, { strokeWidth: 4 })
  ui.bark.x = W / 2
  ui.bark.y = 136
  ui.barkGroup.addChild(ui.bark)
}

function bark(key, opts = {}) {
  const text = BARK[key] ? pick(BARK[key]) : key
  ui.bark.text = text
  gsap.killTweensOf(ui.bark.scale)
  gsap.fromTo(ui.bark.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.35, ease: "back.out(3)" })
  gsap.fromTo(ui.bark, { alpha: 0.2 }, { alpha: 1, duration: 0.2 })
  if (opts.voice && Math.random() < opts.voice) {
    if (SHOUTS[key]) audio.shout(SHOUTS[key])
    else audio.say(text, opts)
  }
  return text
}

function buildGauge() {
  const root = new Container()
  root.x = 170
  root.y = 300
  world.addChild(root)
  const caption = txt("MULTIPLIKATOR", 20, BRASS, { strokeWidth: 3 })
  caption.y = -150
  root.addChild(caption)
  const dial = new Sprite(textures.gauge)
  dial.anchor.set(0.5)
  dial.width = 250
  dial.height = 250
  root.addChild(dial)
  const needle = new Graphics()
  needle.poly([-6, 10, 0, -92, 6, 10]).fill({ color: 0xff5a3a })
  needle.circle(0, 0, 14).fill({ color: 0xd9b25a }).stroke({ width: 3, color: 0x3a2508 })
  root.addChild(needle)
  const value = txt("×1", 46, 0xffffff, { strokeWidth: 6 })
  value.y = 64
  root.addChild(value)
  ui.gauge = { root, needle, value, current: 1 }
  setGauge(1, true)

  ui.buyHunter = makeButton("LEISE JAGD", 220, 66, () => buy("hunter"), { size: 26 })
  ui.buyHunter.x = 170
  ui.buyHunter.y = 520
  ui.buyHunterCost = txt("", 16, 0xcfd8dc, { stroke: false })
  ui.buyHunterCost.y = 22
  ui.buyHunter.addChild(ui.buyHunterCost)
  ui.buyHunterCost.x = 110
  ui.buyHunter.caption.y = 26
  ui.buyPack = makeButton("RUDEL", 220, 66, () => buy("pack"), { size: 26, top: "#3a1a14", bottom: "#140605", rim: "#e0603a" })
  ui.buyPack.x = 170
  ui.buyPack.y = 600
  ui.buyPackCost = txt("", 16, 0xcfd8dc, { stroke: false })
  ui.buyPackCost.y = 22
  ui.buyPackCost.x = 110
  ui.buyPack.addChild(ui.buyPackCost)
  ui.buyPack.caption.y = 26
  ui.buyPackCost.y = 50
  ui.buyHunterCost.y = 50
  const buyLabel = txt("BONUS KAUFEN", 16, 0x9fb7c4, { stroke: false })
  buyLabel.x = 170
  buyLabel.y = 470
  world.addChild(buyLabel, ui.buyHunter, ui.buyPack)
}

function setGauge(value, instant = false) {
  const g = ui.gauge
  g.current = value
  g.value.text = `×${value}`
  const ratio = Math.min(1, (value - 1) / 27)
  const angle = -Math.PI * 0.75 + ratio * Math.PI * 1.5
  if (instant) g.needle.rotation = angle
  else {
    gsap.to(g.needle, { rotation: angle, duration: 0.7, ease: "elastic.out(1, 0.45)" })
    gsap.fromTo(g.value.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(3)" })
  }
  g.value.tint = value > 1 ? 0xffd27a : 0xffffff
}

function buildSonarPanel() {
  const root = new Container()
  root.x = 1310
  root.y = 180
  world.addChild(root)
  root.addChild(sized(art.panelTexture(240, 220, { top: "#0e1f17", bottom: "#030806", rim: "#3f8a5a" }), 240, 220))
  const title = txt("SONAR", 28, SONAR_GREEN, { strokeWidth: 3 })
  title.x = 120
  title.y = 32
  root.addChild(title)
  ui.sonarLamps = []
  for (let i = 0; i < 4; i++) {
    const lamp = new Container()
    lamp.x = 45 + i * 50
    lamp.y = 92
    const base = new Graphics().circle(0, 0, 17).fill({ color: 0x0b1a12 }).stroke({ width: 3, color: 0x2f5a40 })
    const light = new Sprite(textures.greenGlow)
    light.anchor.set(0.5)
    light.scale.set(0.9)
    light.blendMode = "add"
    light.alpha = 0
    lamp.addChild(base, light)
    lamp.light = light
    root.addChild(lamp)
    ui.sonarLamps.push(lamp)
  }
  const rules = txt("3 × SONAR  ·  LEISE JAGD\n4 × SONAR  ·  RUDEL", 17, 0xb9d6c4, { stroke: false })
  rules.x = 120
  rules.y = 160
  root.addChild(rules)

  const info = new Container()
  info.x = 1310
  info.y = 420
  world.addChild(info)
  info.addChild(sized(art.panelTexture(240, 170, {}), 240, 170))
  ui.infoTitle = txt("WEGE", 22, BRASS, { strokeWidth: 3 })
  ui.infoTitle.x = 120
  ui.infoTitle.y = 36
  ui.infoValue = txt("576", 64, 0xffffff, { strokeWidth: 6 })
  ui.infoValue.x = 120
  ui.infoValue.y = 92
  ui.infoSub = txt("", 16, 0x9fb7c4, { stroke: false })
  ui.infoSub.x = 120
  ui.infoSub.y = 142
  info.addChild(ui.infoTitle, ui.infoValue, ui.infoSub)
}

function setSonarLamps(count) {
  ui.sonarLamps.forEach((lamp, index) => {
    const on = index < count
    gsap.to(lamp.light, { alpha: on ? 1 : 0, duration: 0.2 })
    if (on) gsap.fromTo(lamp.light.scale, { x: 1.8, y: 1.8 }, { x: 0.9, y: 0.9, duration: 0.4 })
  })
}

function updateWays(grid) {
  if (state.mode === "base") {
    ui.infoTitle.text = "WEGE"
    ui.infoValue.text = money(displayedWays(grid))
    ui.infoSub.text = "Gewinne von links nach rechts"
  } else {
    ui.infoTitle.text = state.mode === "hunter" ? "LEISE JAGD" : "RUDEL"
    ui.infoValue.text = String(state.freeSpins)
    ui.infoSub.text = `FREISPIELE  ·  ${money(displayedWays(grid))} WEGE`
  }
}

function baySegX(index) {
  const pad = 46
  const gap = (BAY_W - pad * 2 - 4 * SEG_W) / 3
  return BAY_X + pad + index * (SEG_W + gap)
}

function buildTubes() {
  const names = ["HECK", "MOTOR", "LADUNG", "BUG"]
  ui.tubes = []
  ui.bayMask = new Graphics()
  ui.bayMask.rect(BAY_X - 80, BAY_LIP - 2, BAY_W + 160, 480).fill(0xffffff)
  ui.bayMask.visible = false
  ui.board.addChild(ui.bayMask)
  ui.hatches = new Container()
  ui.hatches.visible = false
  ui.board.addChild(ui.hatches)
  const half = BAY_W / 2
  const hatch = (side) => {
    const door = new Graphics()
    const x = side < 0 ? -half + 8 : 4
    door.roundRect(x, 0, half - 12, 20, 4).fill({ color: 0x1a2229 }).stroke({ width: 3, color: 0xb08a48 })
    door.roundRect(x + 8, 6, half - 28, 7, 2).fill({ color: 0x0c1114 })
    door.x = W / 2
    door.y = BAY_LIP - 18
    return door
  }
  ui.hatchL = hatch(-1)
  ui.hatchR = hatch(1)
  ui.seam = new Graphics()
  ui.seam.rect(BAY_X + 24, BAY_LIP - 4, BAY_W - 48, 5).fill({ color: 0xffb347 })
  ui.seam.alpha = 0
  ui.seam.blendMode = "add"
  ui.hatches.addChild(ui.hatchL, ui.hatchR, ui.seam)
  ui.launcher = new Container()
  ui.launcher.y = -BAY_TRAVEL
  ui.launcher.visible = false
  ui.launcherOpen = false
  ui.board.addChild(ui.launcher)
  ui.cradle = new Graphics()
  ui.launcher.addChild(ui.cradle)
  drawCradle()
  ui.bayLamps = []
  const lampYs = [BAY_TOP + 7, BAY_TOP + BAY_H - 7]
  lampYs.forEach((y) => {
    for (let i = 0; i < 5; i++) {
      const lamp = new Sprite(textures.redGlow)
      lamp.anchor.set(0.5)
      lamp.x = BAY_X + 70 + i * ((BAY_W - 140) / 4)
      lamp.y = y
      lamp.scale.set(0.22)
      lamp.blendMode = "add"
      lamp.alpha = 0
      lamp.tint = 0xff2418
      ui.launcher.addChild(lamp)
      ui.bayLamps.push(lamp)
    }
  })
  ui.tubeRoot = new Container()
  ui.launcher.addChild(ui.tubeRoot)
  ui.torpedo = new Container()
  ui.tubeRoot.addChild(ui.torpedo)
  for (let i = 0; i < 4; i++) {
    const seg = new Container()
    seg.homeX = baySegX(i)
    seg.x = seg.homeX
    seg.y = BAY_TOP + 2
    const glow = new Sprite(textures.amberGlow)
    glow.anchor.set(0.5)
    glow.x = SEG_W / 2
    glow.y = SEG_H / 2
    glow.scale.set(3.6, 1.4)
    glow.blendMode = "add"
    glow.alpha = 0
    const ghost = new Sprite(textures.segments[i])
    ghost.anchor.set(0.5)
    ghost.scale.set(0.5)
    ghost.x = SEG_W / 2
    ghost.y = SEG_H / 2
    ghost.tint = 0x6a7a86
    ghost.alpha = 0.45
    const body = new Sprite(textures.segments[i])
    body.anchor.set(0.5)
    body.scale.set(0.5)
    body.x = SEG_W / 2
    body.y = SEG_H / 2
    body.alpha = 0
    const shine = new Sprite(textures.ray)
    shine.anchor.set(0.5)
    shine.width = 40
    shine.height = SEG_H
    shine.rotation = 0.4
    shine.blendMode = "add"
    shine.alpha = 0
    shine.y = SEG_H / 2
    const pips = new Graphics()
    pips.y = SEG_H - 8
    const label = txt(names[i], 13, 0x8fa3ad, { stroke: false })
    label.x = SEG_W / 2
    label.y = SEG_H / 2
    const value = txt("", 26, 0xffffff, { strokeWidth: 4 })
    value.x = SEG_W / 2
    value.y = SEG_H / 2
    seg.addChild(glow, ghost, body, shine, pips, label, value)
    Object.assign(seg, { glow, ghost, body, shine, pips, label, value })
    if (i === 0) {
      const prop = new Graphics()
      prop.ellipse(0, -9, 3.5, 9).fill({ color: 0xc9a157 })
      prop.ellipse(0, 9, 3.5, 9).fill({ color: 0xc9a157 })
      prop.ellipse(-9, 0, 9, 3.5).fill({ color: 0xa07a32 })
      prop.ellipse(9, 0, 9, 3.5).fill({ color: 0xa07a32 })
      prop.circle(0, 0, 4).fill({ color: 0x3a3f44 })
      prop.x = 6
      prop.y = SEG_H / 2
      prop.scale.set(0.35, 1)
      prop.alpha = 0
      seg.addChild(prop)
      seg.prop = prop
    }
    ui.torpedo.addChild(seg)
    ui.tubes.push(seg)
  }
  ui.tubeCaption = txt("", 15, 0xe7d7a4, { strokeWidth: 3 })
  ui.tubeCaption.x = W / 2
  ui.tubeCaption.y = BAY_TOP + BAY_H - 8
  ui.launcher.addChild(ui.tubeCaption)
  const cap = (outward) => {
    const door = new Graphics()
    const mouth = BAY_H
    const reach = outward * (mouth / 2)
    door.moveTo(0, 0)
    door.bezierCurveTo(reach, 0, reach, mouth, 0, mouth)
    door.closePath()
    door.fill({ color: 0x10161b, alpha: 0.98 })
    door.moveTo(0, 0)
    door.bezierCurveTo(reach, 0, reach, mouth, 0, mouth)
    door.stroke({ width: 4, color: 0xb08a48, cap: "round", join: "round" })
    return door
  }
  ui.capRear = cap(-1)
  ui.capRear.x = BAY_X
  ui.capRear.y = BAY_TOP
  ui.capBow = cap(1)
  ui.capBow.x = BAY_X + BAY_W
  ui.capBow.y = BAY_TOP
  ui.launcher.addChild(ui.capRear, ui.capBow)
  ui.bayArmed = false
  drawTubes(freshTubes())
}

function drawCradle() {
  const g = ui.cradle
  const x = BAY_X
  const y = BAY_TOP
  const w = BAY_W
  const h = BAY_H
  g.clear()
  g.roundRect(x + 2, y + 2, w - 4, h - 4, 8).fill({ color: 0x10161b, alpha: 0.98 })
  g.roundRect(x + 22, y + 16, w - 44, h - 40, 20).fill({ color: 0x06090c }).stroke({ width: 2, color: 0x31404a })
  g.moveTo(x, y).lineTo(x + w, y).stroke({ width: 4, color: 0xb08a48, cap: "round" })
  g.moveTo(x, y + h).lineTo(x + w, y + h).stroke({ width: 4, color: 0xb08a48, cap: "round" })
  g.moveTo(x + 20, y + 7).lineTo(x + w - 20, y + 7).stroke({ width: 1, color: 0xffffff, alpha: 0.1 })
}

function setBayArmed(on) {
  if (!ui.capRear || ui.bayArmed === on) return
  ui.bayArmed = on
  const openAngle = 135 * Math.PI / 180
  gsap.to(ui.capRear, { rotation: on ? openAngle : 0, duration: 1.45, ease: on ? "power1.inOut" : "power2.in" })
  gsap.to(ui.capBow, { rotation: on ? -openAngle : 0, duration: 1.45, ease: on ? "power1.inOut" : "power2.in" })
  ui.bayLamps.forEach((lamp, index) => {
    gsap.killTweensOf(lamp)
    if (on) {
      lamp.alpha = 0.2
      gsap.to(lamp, { alpha: 0.9, duration: 0.28 + (index % 5) * 0.04, yoyo: true, repeat: -1, ease: "sine.inOut" })
    } else gsap.to(lamp, { alpha: 0, duration: 0.25 })
  })
  if (on) {
    audio.sfx.hydraulic(0.45)
    audio.sfx.clank()
  }
}

function drawTubes(values) {
  if (!ui.launcherOpen) return
  if (!ui.launching) ui.tubeRoot.alpha = 1
  const ready = values.filter((v) => v > 0).length
  ui.tubeCaption.text = ready === 4 ? "TORPEDO KOMPLETT — FEUER!" : `TORPEDO BAUEN  ·  ${ready} / 4 TEILE  ·  KOMPLETT = ABSCHUSS`
  if (!ui.launching) setBayArmed(ready >= 2)
  if (ui.launching) return
  ui.tubes.forEach((seg, index) => {
    const v = values[index]
    seg.body.alpha = v > 0 ? 1 : 0
    seg.label.alpha = v > 0 ? 0 : 1
    seg.value.text = v > 0 ? `×${v}` : ""
    seg.glow.alpha = v > 0 ? 0.3 : 0
    if (seg.prop) seg.prop.alpha = v > 0 ? 1 : 0.25
    seg.pips.clear()
    for (let pip = 0; pip < 9; pip++) {
      seg.pips.roundRect(8 + pip * 14, 0, 10, 5, 2).fill({ color: pip < v ? 0xffb347 : 0x2a3138 })
    }
  })
}

async function deployLauncher() {
  if (ui.launcherOpen) return
  ui.launcherOpen = true
  ui.bayMask.visible = true
  ui.launcher.mask = ui.bayMask
  ui.launcher.y = -BAY_TRAVEL
  ui.launcher.visible = true
  ui.hatches.visible = true
  gsap.killTweensOf([ui.launcher, ui.hatchL.scale, ui.hatchR.scale, ui.seam, ui.board, ui.board.scale])
  ui.launcher.y = -BAY_TRAVEL
  ui.hatchL.scale.x = 1
  ui.hatchR.scale.x = 1
  ui.seam.alpha = 0
  drawTubes(state.tubes)
  bark("Rohre ausfahren!")
  audio.sfx.hydraulic(1.35)
  audio.sfx.groan()
  applyBoardFrame(false)
  gsap.to(ui.seam, { alpha: 1, duration: 0.12, yoyo: true, repeat: 5 })
  await Promise.all([
    tween(ui.hatchL.scale, { x: 0.02, duration: 0.42, ease: "power3.in" }),
    tween(ui.hatchR.scale, { x: 0.02, duration: 0.42, ease: "power3.in" }),
  ])
  ui.hatches.visible = false
  audio.sfx.clank()
  await tween(ui.launcher, {
    y: 0,
    duration: 0.85,
    ease: "power3.out",
    onUpdate: () => {
      if (Math.random() < 0.45) {
        const puff = toWorld(BAY_X + 40 + Math.random() * (BAY_W - 80), BAY_LIP)
        bubbles(puff.x, puff.y, 1, 16)
      }
    },
  })
  ui.launcher.mask = null
  ui.bayMask.visible = false
  audio.sfx.impact(0.45)
  shake(8, 0.28)
}

async function stowLauncher() {
  if (!ui.launcherOpen || ui.launching) return
  ui.launcher.mask = ui.bayMask
  ui.bayMask.visible = true
  audio.sfx.hydraulic(0.9)
  await tween(ui.launcher, { y: -BAY_TRAVEL, duration: 0.6, ease: "power3.in" })
  await Promise.all([
    tween(ui.hatchL.scale, { x: 1, duration: 0.28, ease: "power2.out" }),
    tween(ui.hatchR.scale, { x: 1, duration: 0.28, ease: "power2.out" }),
  ])
  audio.sfx.clank()
  ui.launcher.visible = false
  ui.hatches.visible = false
  ui.launcher.mask = null
  ui.bayMask.visible = false
  ui.seam.alpha = 0
  ui.launcherOpen = false
  ui.tubeCaption.text = ""
  setBayArmed(false)
  applyBoardFrame(false)
  await wait(0.7)
}

function tubeCenter(index) {
  const seg = ui.tubes[index]
  return toWorld(seg.x + SEG_W / 2, seg.y + ui.launcher.y + SEG_H / 2)
}

function weldSparks(x, y, count = 22) {
  particles.emit(textures.dot, x, y, { count, speed: 360, scale: 0.18, life: 0.55, gravity: 700, spreadY: 36, blend: "add", tint: [0xffffff, 0xfff2a0, 0x9fe8ff] })
  const flash = new Sprite(textures.flare)
  flash.anchor.set(0.5)
  flash.x = x
  flash.y = y
  flash.blendMode = "add"
  flash.tint = 0xbfeaff
  flash.scale.set(0.8)
  fxLayer.addChild(flash)
  gsap.to(flash, { alpha: 0, duration: 0.3, onComplete: () => flash.destroy() })
}

function segmentPulse(index, fresh) {
  const seg = ui.tubes[index]
  const c = tubeCenter(index)
  gsap.fromTo(seg.shine, { x: -30, alpha: 0.85 }, { x: SEG_W + 30, alpha: 0.4, duration: 0.6, ease: "power2.inOut" })
  gsap.fromTo(seg.value.scale, { x: 2.2, y: 2.2 }, { x: 1, y: 1, duration: 0.45, ease: "back.out(3)" })
  gsap.fromTo(seg.glow, { alpha: 1 }, { alpha: 0.3, duration: 0.8 })
  if (fresh) {
    gsap.fromTo(seg.body, { alpha: 0 }, { alpha: 1, duration: 0.3 })
    gsap.fromTo(seg.body.scale, { x: 0.68, y: 0.68 }, { x: 0.5, y: 0.5, duration: 0.5, ease: "back.out(3)" })
    weldSparks(c.x - SEG_W / 2, c.y)
    weldSparks(c.x + SEG_W / 2, c.y)
    audio.sfx.weld(0.5)
    audio.sfx.clank()
    shake(6, 0.2)
  } else {
    gsap.fromTo(seg.scale, { x: 1.06, y: 1.12 }, { x: 1, y: 1, duration: 0.35, ease: "back.out(3)" })
    audio.sfx.charge()
  }
}

function buildHud() {
  const panel = sized(art.panelTexture(1600, 120, { radius: 0, top: "#22292e", bottom: "#07090b", rim: "#6f5a30" }), 1600, 120)
  panel.y = 790
  world.addChild(panel)
  const stat = (x, title, size = 40) => {
    const caption = txt(title, 17, BRASS, { stroke: false })
    caption.x = x
    caption.y = 818
    const value = txt("0", size, 0xffffff, { strokeWidth: 4 })
    value.x = x
    value.y = 858
    world.addChild(caption, value)
    return value
  }
  ui.balance = stat(130, "GUTHABEN")
  ui.bet = stat(400, "EINSATZ")
  ui.win = stat(760, "GEWINN", 52)
  ui.win.tint = 0xffe7a0
  const minus = makeButton("–", 52, 52, () => stepBet(-1), { size: 34 })
  minus.x = 318
  minus.y = 858
  const plus = makeButton("+", 52, 52, () => stepBet(1), { size: 34 })
  plus.x = 482
  plus.y = 858
  ui.auto = makeButton("AUTO", 100, 52, toggleAuto, { size: 22 })
  ui.auto.x = 1000
  ui.auto.y = 850
  ui.turbo = makeButton("TURBO", 100, 52, toggleTurbo, { size: 22 })
  ui.turbo.x = 1112
  ui.turbo.y = 850
  const menu = makeButton("MENÜ", 100, 52, openSheet, { size: 22 })
  menu.x = 1224
  menu.y = 850
  world.addChild(minus, plus, ui.auto, ui.turbo, menu)

  const fire = new Container()
  fire.x = 1440
  fire.y = 790
  const ring = new Graphics()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ring.moveTo(Math.cos(a) * 30, Math.sin(a) * 30).lineTo(Math.cos(a) * 66, Math.sin(a) * 66)
  }
  ring.stroke({ width: 8, color: 0xe2b04a, alpha: 0.9 })
  ring.circle(0, 0, 66).stroke({ width: 6, color: 0xe2b04a, alpha: 0.9 })
  const dome = new Sprite(textures.fireButton)
  dome.anchor.set(0.5)
  dome.width = 190
  dome.height = 190
  const halo = new Sprite(textures.redGlow)
  halo.anchor.set(0.5)
  halo.scale.set(2.3)
  halo.blendMode = "add"
  halo.alpha = 0.35
  const label = txt("FEUER", 34, 0xffffff, { strokeWidth: 5 })
  label.y = 4
  fire.addChild(halo, dome, ring, label)
  fire.eventMode = "static"
  fire.cursor = "pointer"
  fire.hitArea = new Rectangle(-95, -95, 190, 190)
  fire.on("pointerdown", () => gsap.to(fire.scale, { x: 0.92, y: 0.92, duration: 0.06 }))
  fire.on("pointerup", () => gsap.to(fire.scale, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" }))
  fire.on("pointerupoutside", () => gsap.to(fire.scale, { x: 1, y: 1, duration: 0.2 }))
  fire.on("pointertap", () => onSpin())
  world.addChild(fire)
  ui.fire = { root: fire, ring, label, halo }
  gsap.to(halo, { alpha: 0.65, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" })
  const hint = txt("LEERTASTE", 13, 0x8fa3ad, { stroke: false })
  hint.x = 1440
  hint.y = 888
  world.addChild(hint)
}

function refreshHud() {
  ui.balance.text = money(state.balance)
  ui.bet.text = money(state.bet)
  if (!ui.winCounting) ui.win.text = money(state.spinWin)
  ui.buyHunterCost.text = `${money(state.bet * BUY.hunter)} Kredite`
  ui.buyPackCost.text = `${money(state.bet * BUY.pack)} Kredite`
  const canBuy = state.mode === "base" && !state.busy
  ui.buyHunter.alpha = canBuy && state.balance >= state.bet * BUY.hunter ? 1 : 0.45
  ui.buyPack.alpha = canBuy && state.balance >= state.bet * BUY.pack ? 1 : 0.45
  ui.auto.caption.text = state.autoplay > 0 ? `STOP ${state.autoplay}` : "AUTO"
  ui.turbo.caption.tint = state.turbo ? 0xffe27a : 0x8f8a7a
  ui.fire.label.text = state.busy ? "STOP" : state.freeSpins > 0 ? String(state.freeSpins) : "FEUER"
  drawTubes(state.tubes)
  updateWays(state.grid)
}

function countWin(target) {
  const proxy = { v: Number(String(ui.win.text).replace(/\./g, "")) || 0 }
  ui.winCounting = true
  gsap.to(proxy, {
    v: target,
    duration: 0.6,
    ease: "power2.out",
    onUpdate: () => { ui.win.text = money(proxy.v) },
    onComplete: () => { ui.winCounting = false },
  })
  gsap.fromTo(ui.win.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(3)" })
}

function fit() {
  const sw = app.screen.width
  const sh = app.screen.height
  const scale = Math.min(sw / W, sh / H)
  world.scale.set(scale)
  world.x = (sw - W * scale) / 2
  world.y = (sh - H * scale) / 2
  for (const sprite of Object.values(ui.bg)) {
    const tex = sprite.texture
    const cover = Math.max(sw / tex.width, sh / tex.height)
    sprite.scale.set(cover)
    sprite.x = sw / 2
    sprite.y = sh / 2
  }
  ui.bgShade.clear().rect(0, 0, sw, sh).fill({ color: 0x02060a, alpha: 0.38 })
  ui.vignette.width = sw
  ui.vignette.height = sh
}

async function spinReels(grid) {
  fitBoard(grid.map((column) => column.length))
  const sonarsBefore = []
  let running = 0
  grid.forEach((column, reel) => {
    sonarsBefore.push(running)
    running += column.filter((cell) => cell.symbol === "sonar").length
  })
  let landedSonars = 0
  let cruise = 0.42
  const jobs = grid.map((column, reel) => {
    const anticipate = state.mode === "base" && reel >= 2 && reel <= 4 && sonarsBefore[reel] >= 2
    cruise += anticipate ? 0.32 : 0.13
    return reels[reel].spinTo(column, { delay: reel * 0.05, cruise, anticipate }).then(() => {
      const found = column.map((cell, row) => ({ cell, row })).filter(({ cell }) => cell.symbol === "sonar")
      found.forEach(({ row }) => {
        landedSonars += 1
        const center = reels[reel].cellCenter(row)
        sonarRing(center.x, center.y)
        audio.sfx.sonar(landedSonars)
      })
      if (found.length) setSonarLamps(landedSonars)
      if (column.some((cell) => cell.symbol === "mine")) audio.sfx.clank()
    })
  })
  await Promise.all(jobs)
  state.grid = grid
  updateWays(grid)
}

function sonarRing(x, y) {
  for (let i = 0; i < 3; i++) {
    const ring = new Graphics().circle(0, 0, 30).stroke({ width: 4, color: SONAR_GREEN })
    ring.x = x
    ring.y = y
    ring.alpha = 0.9
    fxLayer.addChild(ring)
    gsap.to(ring.scale, { x: 4, y: 4, duration: 0.9, delay: i * 0.18, ease: "power1.out" })
    gsap.to(ring, { alpha: 0, duration: 0.9, delay: i * 0.18, onComplete: () => ring.destroy() })
  }
  const glow = new Sprite(textures.greenGlow)
  glow.anchor.set(0.5)
  glow.x = x
  glow.y = y
  glow.blendMode = "add"
  glow.scale.set(2.5)
  fxLayer.addChild(glow)
  gsap.to(glow, { alpha: 0, duration: 0.9, onComplete: () => glow.destroy() })
}

function winTier(amount) {
  const ratio = amount / Math.max(1, state.roundBet || state.bet)
  if (ratio >= 100) return 4
  if (ratio >= 25) return 3
  if (ratio >= 8) return 2
  if (ratio >= 2) return 1
  return 0
}

function drawWinLines(lines) {
  const top = lines.slice().sort((a, b) => b.amount - a.amount).slice(0, 3)
  const colors = [0xffd27a, 0x9ff4ff, 0xff8a4a]
  top.forEach((line, k) => {
    const points = []
    for (let reel = 0; reel < line.reels; reel++) {
      const rows = line.positions.filter((pos) => pos.reel === reel).map((pos) => pos.row)
      if (!rows.length) continue
      points.push(reels[reel].cellCenter(rows[Math.floor(rows.length / 2)]))
    }
    if (points.length < 2) return
    const g = new Graphics()
    g.blendMode = "add"
    fxLayer.addChild(g)
    const proxy = { t: 0 }
    const draw = () => {
      g.clear()
      const reach = proxy.t * (points.length - 1)
      const path = [points[0]]
      for (let i = 1; i < points.length; i++) {
        if (i <= reach) path.push(points[i])
        else {
          const f = reach - (i - 1)
          if (f > 0) path.push({ x: points[i - 1].x + (points[i].x - points[i - 1].x) * f, y: points[i - 1].y + (points[i].y - points[i - 1].y) * f })
          break
        }
      }
      const trace = (width, alpha) => {
        g.moveTo(path[0].x, path[0].y)
        path.slice(1).forEach((pt) => g.lineTo(pt.x, pt.y))
        g.stroke({ width, color: colors[k], alpha, cap: "round", join: "round" })
      }
      trace(18, 0.18)
      trace(5, 0.95)
      path.forEach((pt) => g.circle(pt.x, pt.y, 7).fill({ color: 0xffffff, alpha: 0.9 }))
    }
    gsap.to(proxy, { t: 1, duration: 0.45, delay: k * 0.18, ease: "power2.out", onUpdate: draw })
    gsap.to(g, { alpha: 0, duration: 0.4, delay: 1.3 + k * 0.18, onComplete: () => g.destroy() })
  })
}

async function flyMultiplier(value) {
  const tag = txt(`×${value}`, 54, 0xffd27a, { font: SERIF, strokeWidth: 6, blur: 8 })
  tag.x = ui.gauge.root.x
  tag.y = ui.gauge.root.y + 64
  fxLayer.addChild(tag)
  audio.sfx.whoosh()
  const target = boardCenter()
  gsap.to(tag.scale, { x: 1.6, y: 1.6, duration: 0.4 })
  await tween(tag, {
    x: target.x,
    y: target.y,
    duration: 0.45,
    ease: "power2.in",
    onUpdate: () => particles.emit(textures.amberGlow, tag.x, tag.y, { count: 1, speed: 10, scale: 0.6, life: 0.35, gravity: 0, blend: "add" }),
  })
  sparks(target.x, target.y, 30)
  audio.sfx.impact(0.5)
  tag.destroy()
}

function pulseHousing(color = 0xffd27a, times = 1) {
  ui.housingGlow.tint = color
  gsap.killTweensOf(ui.housingGlow)
  ui.housingGlow.alpha = 0
  gsap.to(ui.housingGlow, { alpha: 1, duration: 0.18, yoyo: true, repeat: times * 2 - 1, ease: "sine.inOut" })
}

async function presentScored(event) {
  const byReel = new Map()
  for (const line of event.lines) {
    for (const pos of line.positions) {
      if (!byReel.has(pos.reel)) byReel.set(pos.reel, new Set())
      byReel.get(pos.reel).add(pos.row)
    }
  }
  byReel.forEach((rows, reel) => reels[reel].highlight(rows))
  drawWinLines(event.lines)
  const best = event.lines.slice().sort((a, b) => b.amount - a.amount)[0]
  const tier = winTier(event.paid)
  const label = `${best.reels}× ${TITLES[best.symbol]}  ·  ${best.ways} WEGE${event.multiplier > 1 ? `  ·  ×${event.multiplier}` : ""}`
  ui.bark.text = label
  gsap.fromTo(ui.bark.scale, { x: 1.15, y: 1.15 }, { x: 1, y: 1, duration: 0.3 })
  pulseHousing(tier >= 2 ? 0xffd27a : 0x9ff4ff, tier >= 2 ? 3 : 1)
  audio.sfx.win(tier)
  if (tier >= 2) audio.winSting(tier)
  if (event.multiplier > 1) {
    if (event.multiplier !== ui.gauge.current) setGauge(event.multiplier)
    await flyMultiplier(event.multiplier)
  }
  state.balance += event.paid
  state.spinWin += event.paid
  state.roundWin += event.paid
  save()
  countWin(state.spinWin)
  ui.balance.text = money(state.balance)
  ui.winPop.text = money(event.paid)
  ui.winPop.alpha = 1
  gsap.killTweensOf(ui.winPop)
  gsap.killTweensOf(ui.winPop.scale)
  gsap.fromTo(ui.winPop.scale, { x: 0.3, y: 0.3 }, { x: 1 + tier * 0.14, y: 1 + tier * 0.14, duration: 0.45, ease: "back.out(2.5)" })
  gsap.to(ui.winPop, { alpha: 0, duration: 0.35, delay: 0.9 + tier * 0.2 })
  const center = boardCenter()
  ui.winPop.y = center.y
  sparks(center.x, center.y, tier >= 2 ? 60 : 22, [0xffe08a, 0xffffff])
  if (tier >= 1) {
    particles.emit(textures.coin, center.x, center.y, { count: 6 + tier * 10, speed: 520 + tier * 120, scale: 0.4, life: 1.5, gravity: 900, spin: 8 })
    audio.sfx.coins(4 + tier * 6)
  }
  if (tier >= 2) {
    const ring = new Graphics().circle(0, 0, 60).stroke({ width: 8, color: 0xffd27a })
    ring.x = center.x
    ring.y = center.y
    ring.blendMode = "add"
    fxLayer.addChild(ring)
    gsap.to(ring.scale, { x: 7, y: 7, duration: 0.7, ease: "power2.out" })
    gsap.to(ring, { alpha: 0, duration: 0.7, onComplete: () => ring.destroy() })
    shake(6 + tier * 2, 0.35)
    crewSay(tier >= 3 ? "captain" : pick(["officer", "engineer", "radio"]), pick(tier >= 3 ? BARK.huge : BARK.big))
  } else if (tier === 1 && Math.random() < 0.35) {
    crewSay(pick(["cook", "radio", "engineer"]), pick(BARK.mid))
  }
  if (tier >= 3) gsap.delayedCall(0.5, () => bark(tier >= 4 ? "huge" : "big", { voice: 1 }))
  await wait(1.0 + tier * 0.2)
}

async function presentBlast(event) {
  const spots = []
  state.grid.forEach((column, reel) => column.forEach((cell, row) => {
    if (cell.symbol === "mine") spots.push(reels[reel].cellCenter(row))
  }))
  bark("mine", { voice: 0.6 })
  if (Math.random() < 0.4) crewSay("engineer", "Achtung, Mine!")
  for (const spot of spots) {
    explosion(spot.x, spot.y, 1.1)
  }
  audio.sfx.explosion(1)
  screenFlash(0xffa040, 0.45, 0.5)
  setGauge(event.multiplier)
  await shake(18, 0.6)
  await wait(0.2)
}

async function presentExpanded(event) {
  bark("expand", { voice: 0.5 })
  audio.sfx.hydraulic(1)
  audio.sfx.groan()
  gsap.delayedCall(0.35, () => audio.sfx.clank())
  pulseHousing(SONAR_GREEN, 2)
  const banner = new Sprite(art.titleTexture("FELD ERWEITERT", 70, { spacing: 6, colors: ["#e9ffef", "#5dff9a", "#0f5a30"] }))
  banner.anchor.set(0.5)
  banner.x = W / 2
  banner.y = boardCenter().y
  banner.scale.set(0)
  overlayLayer.addChild(banner)
  gsap.to(banner.scale, { x: 0.5, y: 0.5, duration: 0.45, ease: "back.out(2.5)" })
  gsap.to(banner, { alpha: 0, duration: 0.4, delay: 1.1, onComplete: () => banner.destroy() })
  event.reels.forEach((reel) => {
    const r = reels[reel]
    const top = r.cellCenter(0)
    bubbles(top.x, top.y - 40, 14, 120)
    sparks(top.x, top.y - CELL_H * ui.board.scale.y / 2, 18, [0x9ff4ff, 0xffffff])
  })
  shake(10, 0.4)
  await wait(0.6)
}

async function presentCascade(grid) {
  fitBoard(grid.map((column) => column.length))
  await Promise.all(grid.map((column, reel) => reels[reel].cascade(column)))
  state.grid = grid
  updateWays(grid)
}

async function presentNudge(event) {
  bark("depth", { voice: 0.5 })
  audio.sfx.hydraulic(0.3 + event.steps * 0.24)
  await reels[event.reel].nudge(event.grid[event.reel], event.steps)
  state.grid = event.grid
  const center = reels[event.reel].cellCenter(1.5)
  const stamp = txt(`×${event.multiplier}`, 96, 0x9ff4ff, { font: SERIF, strokeWidth: 8, blur: 12 })
  stamp.x = center.x
  stamp.y = center.y
  fxLayer.addChild(stamp)
  gsap.fromTo(stamp.scale, { x: 3, y: 3 }, { x: 1, y: 1, duration: 0.35, ease: "power3.in" })
  gsap.to(stamp, { alpha: 0, y: center.y - 60, duration: 0.6, delay: 0.7, onComplete: () => stamp.destroy() })
  await wait(0.35)
  audio.sfx.clank()
  shake(10, 0.3)
  setGauge(Math.max(ui.gauge.current, event.multiplier))
  await wait(0.5)
}

async function presentCurrents(grid) {
  const spots = []
  grid.forEach((column, reel) => column.forEach((cell, row) => {
    if (cell.ways > 1 && !cell.reelStack) spots.push({ reel, row, ways: cell.ways })
  }))
  if (!spots.length) return
  bark("current", { voice: 0.4 })
  for (const spot of spots) {
    const view = reels[spot.reel].views[spot.row]
    if (view && view.badge) {
      gsap.fromTo(view.badge.scale, { x: 3, y: 3 }, { x: view.badge.scale.x, y: view.badge.scale.y, duration: 0.4, ease: "back.out(2)" })
    }
    const center = reels[spot.reel].cellCenter(spot.row)
    bubbles(center.x, center.y, 10, 80)
  }
  audio.sfx.charge()
  await wait(0.45)
}

async function presentCharge(event) {
  const before = state.tubes.slice()
  const jobs = []
  for (let reel = 1; reel <= 4; reel++) {
    state.grid[reel].forEach((cell, row) => {
      if (cell.symbol !== "torpedo") return
      const from = reels[reel].cellCenter(row)
      const to = tubeCenter(reel - 1)
      const sprite = new Sprite(textures.torpedoSide)
      sprite.anchor.set(0.5)
      sprite.scale.set(0.42)
      sprite.x = from.x
      sprite.y = from.y
      fxLayer.addChild(sprite)
      const proxy = { t: 0 }
      jobs.push(tween(proxy, {
        t: 1,
        duration: 0.65,
        delay: jobs.length * 0.1,
        ease: "power2.in",
        onUpdate: () => {
          sprite.x = from.x + (to.x - from.x) * proxy.t
          sprite.y = from.y + (to.y - from.y) * proxy.t - Math.sin(Math.PI * proxy.t) * 110
          sprite.rotation = Math.PI * 2 * proxy.t
          sprite.scale.set(0.42 - proxy.t * 0.2)
          if (Math.random() < 0.7) particles.emit(textures.amberGlow, sprite.x, sprite.y, { count: 1, speed: 10, scale: 0.4, life: 0.4, gravity: 0, blend: "add" })
        },
      }).then(() => {
        sprite.destroy()
        sparks(to.x, to.y, 16, [0xffb347, 0xffffff])
      }))
    })
  }
  await Promise.all(jobs)
  state.tubes = event.tubes
  drawTubes(state.tubes)
  event.tubes.forEach((value, index) => {
    if (value !== before[index]) segmentPulse(index, before[index] === 0)
  })
  const ready = event.tubes.filter((v) => v > 0).length
  if (ready === 3) {
    bark("Noch ein Teil — dann Feuer!")
    audio.sfx.riser(0.8)
  }
  await wait(0.5)
}

function torpedoTail(scale) {
  const r = ui.torpedo.rotation
  return toWorld(ui.torpedo.x - Math.cos(r) * SEG_W * 2 * scale, ui.torpedo.y - Math.sin(r) * SEG_W * 2 * scale)
}

async function presentLaunch(event) {
  ui.launching = true
  ui.tubeRoot.alpha = 1
  bark("launch", { voice: 1 })
  audio.sfx.telegraph()
  audio.sfx.alarm()
  ui.tubeCaption.text = "TORPEDO KOMPLETT — FEUER!"
  for (let i = 0; i < 2; i++) gsap.delayedCall(i * 0.7, () => screenFlash(RED, 0.35, 0.45))
  const cx = W / 2
  const cy = ui.tubes[0].y + SEG_H / 2
  const startX = cx - SEG_W * 2
  ui.tubes.forEach((seg, index) => {
    gsap.to([seg.pips, seg.label, seg.value], { alpha: 0, duration: 0.25 })
    gsap.to(seg, { x: startX + index * SEG_W, duration: 0.55, delay: index * 0.06, ease: "power3.inOut" })
  })
  await wait(0.75)
  for (let joint = 1; joint < 4; joint++) {
    gsap.delayedCall(joint * 0.12, () => {
      const joinAt = toWorld(startX + joint * SEG_W, cy)
      weldSparks(joinAt.x, joinAt.y, 30)
    })
  }
  audio.sfx.weld(0.6)
  audio.sfx.clank()
  shake(8, 0.3)
  await wait(0.5)
  ui.tubes.forEach((seg) => {
    gsap.killTweensOf(seg.glow)
    gsap.to(seg.glow, { alpha: 0, duration: 0.15 })
  })
  const total = txt(`×${event.charges.join(" · ×")}`, 30, 0xffe08a, { strokeWidth: 4 })
  const totalAt = toWorld(cx, cy - 48)
  total.x = totalAt.x
  total.y = totalAt.y
  fxLayer.addChild(total)
  gsap.fromTo(total.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(3)" })
  gsap.to(total, { alpha: 0, duration: 0.3, delay: 1.2, onComplete: () => total.destroy() })
  await wait(0.5)

  ui.torpedo.pivot.set(cx, cy)
  ui.torpedo.position.set(cx, cy)
  if (!ui.bayArmed) {
    setBayArmed(true)
    await wait(1.2)
  }
  const prop = ui.tubes[0].prop
  if (prop) gsap.to(prop.scale, { y: -1, duration: 0.05, yoyo: true, repeat: 28, ease: "none" })
  audio.sfx.ignite(0.7)
  audio.sfx.riser(0.55)
  const rumble = gsap.to(ui.torpedo, { y: cy + 2, duration: 0.04, yoyo: true, repeat: 12, ease: "none" })
  await wait(0.45)
  rumble.kill()
  ui.torpedo.y = cy
  audio.sfx.launch()
  audio.sfx.whoosh()
  bark("Torpedo läuft!")
  const trail = setInterval(() => {
    const tail = torpedoTail(ui.torpedo.scale.x)
    particles.emit(textures.bubble, tail.x, tail.y, { count: 10, speed: 460, angle: Math.PI, cone: 0.16, scale: 0.42, life: 1.8, gravity: 30, drag: 0.992, alpha: 0.9 })
    particles.emit(textures.dot, tail.x, tail.y, { count: 6, speed: 620, angle: Math.PI, cone: 0.08, scale: 0.14, life: 1.4, gravity: 8, drag: 0.994, blend: "add", tint: 0xd5f3ff, alpha: 0.5 })
  }, 24)
  await tween(ui.torpedo, { x: W + 560, duration: 0.62, ease: "power2.in" })
  await wait(0.7)
  clearInterval(trail)
  await wait(0.15)

  ui.torpedo.rotation = Math.PI / 2
  ui.torpedo.scale.set(0.9)
  ui.torpedo.position.set(cx, -420)
  audio.sfx.whoosh()
  const dive = setInterval(() => {
    const tail = torpedoTail(ui.torpedo.scale.x)
    particles.emit(textures.bubble, tail.x, tail.y, { count: 4, speed: 80, angle: -Math.PI / 2, cone: 0.5, scale: 0.4, life: 0.8, gravity: 40 })
  }, 30)
  const impactY = area.top + area.height / 2
  await tween(ui.torpedo, { y: impactY - 120, duration: 0.42, ease: "power2.in" })
  const impact = boardCenter()
  clearInterval(dive)
  ui.torpedo.alpha = 0

  audio.sfx.explosion(1.6)
  audio.sfx.impact(1.4)
  audio.shout("treffer", { delay: 0.25 })
  screenFlash(0xffffff, 1, 0.8)
  shake(28, 0.9)
  explosion(impact.x, impact.y, 2.2)
  for (let i = 0; i < 5; i++) {
    gsap.delayedCall(0.12 * i, () => {
      const spot = toWorld(reelX(i % 4 + 1) + CELL_W / 2, impactY + (Math.random() - 0.5) * area.height * 0.6)
      explosion(spot.x, spot.y, 0.8)
    })
  }
  await Promise.all([1, 2, 3, 4].map((reel) => reels[reel].transform(event.grid[reel], reel === 2 || reel === 3 ? 0x9ff4ff : 0xffe08a)))
  state.grid = event.grid
  state.sticky = event.sticky
  state.tubes = freshTubes()
  ;[1, 2, 3, 4].forEach((reel, index) => {
    const center = reels[reel].cellCenter((reels[reel].rows - 1) / 2)
    const stamp = txt(`×${event.charges[index]}`, 72, 0xffe08a, { font: SERIF, strokeWidth: 7, blur: 10 })
    stamp.x = center.x
    stamp.y = center.y
    fxLayer.addChild(stamp)
    gsap.fromTo(stamp.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.4, delay: index * 0.1, ease: "back.out(3)" })
    gsap.to(stamp, { alpha: 0, duration: 0.5, delay: 1.3, onComplete: () => stamp.destroy() })
  })
  setGauge(Math.max(1, state.sticky))

  ui.torpedo.rotation = 0
  ui.torpedo.scale.set(1)
  ui.torpedo.pivot.set(0, 0)
  ui.torpedo.position.set(0, 0)
  ui.tubes.forEach((seg) => {
    seg.x = seg.homeX
    seg.scale.set(1)
    seg.pips.alpha = 1
    seg.value.alpha = 1
    if (seg.prop) gsap.killTweensOf(seg.prop.scale)
  })
  ui.launching = false
  drawTubes(state.tubes)
  gsap.fromTo(ui.torpedo, { alpha: 0 }, { alpha: 1, duration: 0.6, delay: 0.6 })
  await wait(1.1)
}

async function periscopeScene(hit) {
  const scene = new Container()
  cineLayer.addChild(scene)
  const dark = new Graphics().rect(0, 0, W, H).fill({ color: 0x000000 })
  dark.alpha = 0
  scene.addChild(dark)
  gsap.to(dark, { alpha: 0.88, duration: 0.4 })
  const view = new Container()
  view.x = W / 2
  view.y = 430
  scene.addChild(view)
  const R = 290
  const sea = new Sprite(textures.seaView)
  sea.anchor.set(0.5)
  sea.width = R * 2.2
  sea.height = R * 2.2
  view.addChild(sea)
  const ship = new Sprite(textures.ship)
  ship.anchor.set(0.5, 1)
  ship.scale.set(0.42)
  ship.x = -R * 0.9
  ship.y = 12
  view.addChild(ship)
  const lens = new Graphics().circle(0, 0, R).fill(0xffffff)
  view.addChild(lens)
  sea.mask = lens
  ship.mask = lens
  const reticle = new Graphics()
  reticle.circle(0, 0, R).stroke({ width: 34, color: 0x050505 })
  reticle.circle(0, 0, R + 18).stroke({ width: 6, color: 0x9a7a40 })
  reticle.moveTo(-R, 0).lineTo(R, 0).moveTo(0, -R).lineTo(0, R).stroke({ width: 2, color: 0x000000, alpha: 0.85 })
  for (let i = -8; i <= 8; i++) {
    if (!i) continue
    reticle.moveTo(i * 30, -8).lineTo(i * 30, 8)
  }
  reticle.stroke({ width: 2, color: 0x000000, alpha: 0.85 })
  view.addChild(reticle)
  const caption = txt("SEHROHR AUSGEFAHREN", 28, 0xffe08a, { strokeWidth: 4 })
  caption.y = R + 56
  view.addChild(caption)
  view.scale.set(0.15)
  view.alpha = 0
  audio.sfx.hydraulic(1.1)
  gsap.to(view, { alpha: 1, duration: 0.3 })
  await tween(view.scale, { x: 1, y: 1, duration: 0.9, ease: "back.out(1.4)" })
  gsap.to(ship, { x: R * 0.55, duration: 4.5, ease: "none" })
  gsap.to(sea, { y: 8, duration: 1.4, yoyo: true, repeat: 3, ease: "sine.inOut" })
  audio.sfx.sonar(2)
  bark("Ziel erfasst. Rohr eins — los!", { voice: 1 })
  await wait(1.1)
  audio.sfx.launch()
  const wake = new Graphics()
  view.addChild(wake)
  const fish = { t: 0 }
  const targetX = hit ? 40 : 160
  await tween(fish, {
    t: 1,
    duration: 1.4,
    ease: "power1.in",
    onUpdate: () => {
      const x = targetX * fish.t
      const y = R - (R - 10) * fish.t
      wake.clear().moveTo(0, R).lineTo(x, y).stroke({ width: 6 * (1 - fish.t * 0.6), color: 0xdff6ff, alpha: 0.75 })
    },
  })
  const impact = { x: view.x + targetX, y: view.y + 6 }
  if (hit) {
    explosion(impact.x, impact.y, 1.6)
    audio.sfx.explosion(1.5)
    screenFlash(0xffd9a0, 0.6, 0.5)
    shake(24, 0.8)
    bark("hit", { voice: 1 })
    caption.text = "VOLLTREFFER!"
    gsap.killTweensOf(ship)
    gsap.to(ship, { rotation: 0.25, y: 90, alpha: 0, duration: 2.2, ease: "power2.in" })
    for (let i = 0; i < 4; i++) gsap.delayedCall(0.3 + i * 0.25, () => explosion(impact.x + (Math.random() - 0.5) * 120, impact.y - Math.random() * 40, 0.6))
  } else {
    audio.sfx.splash()
    particles.emit(textures.dot, impact.x, impact.y, { count: 40, speed: 380, scale: 0.3, life: 0.9, gravity: 900, cone: 1.2, tint: 0xdff6ff })
    bark("miss", { voice: 0.5 })
    caption.text = "FEHLSCHUSS"
  }
  await wait(1.8)
  audio.sfx.hydraulic(0.6)
  gsap.to(view.scale, { x: 0.2, y: 0.2, duration: 0.5, ease: "power2.in" })
  await tween(view, { alpha: 0, duration: 0.5 })
  await tween(dark, { alpha: 0, duration: 0.3 })
  gsap.killTweensOf(ship)
  gsap.killTweensOf(sea)
  scene.destroy({ children: true })
}

async function presentScope(event) {
  await periscopeScene(event.hit)
  if (!event.hit && Math.random() < 0.6) await neinMoment(false)
  if (event.hit) {
    await reels[2].transform(event.grid[2], 0xffe08a)
    const center = reels[2].cellCenter(3.5)
    const stamp = txt("×8", 110, 0xffe08a, { font: SERIF, strokeWidth: 8, blur: 12 })
    stamp.x = center.x
    stamp.y = center.y
    fxLayer.addChild(stamp)
    gsap.fromTo(stamp.scale, { x: 3, y: 3 }, { x: 1, y: 1, duration: 0.35, ease: "power3.in" })
    gsap.to(stamp, { alpha: 0, duration: 0.5, delay: 1.0, onComplete: () => stamp.destroy() })
    shake(12, 0.4)
    await wait(0.9)
  }
  state.grid = event.grid
}

async function present(outcome) {
  const events = outcome.events
  const landed = events[0]
  audio.sfx.spin()
  setSonarLamps(0)
  if (Math.random() < 0.35) bark("spin")
  await spinReels(landed.grid)
  if (landed.grid.some((column) => column.some((cell) => cell.ways > 1 && !cell.reelStack))) await presentCurrents(landed.grid)
  for (let i = 1; i < events.length; i++) {
    const event = events[i]
    if (event.type === "nudged") await presentNudge(event)
    else if (event.type === "scope") await presentScope(event)
    else if (event.type === "charged") await presentCharge(event)
    else if (event.type === "launched") await presentLaunch(event)
    else if (event.type === "scored") await presentScored(event)
    else if (event.type === "blasted") await presentBlast(event)
    else if (event.type === "expanded") await presentExpanded(event)
    else if (event.type === "fell") {
      await presentCascade(event.grid)
      if (event.grid.some((column) => column.some((cell) => cell.symbol === "sonar"))) {
        const total = event.grid.flat().filter((cell) => cell.symbol === "sonar").length
        setSonarLamps(total)
      }
    } else if (event.type === "abyss") await bigWin(state.roundWin, "DAS GOLD DER TIEFE")
  }
  reels.forEach((reel) => reel.clearGlow())
  state.grid = outcome.finalGrid
  if (!outcome.totalWin && !outcome.triggered) {
    if (state.mode === "base" && outcome.sonarCount === 2 && Math.random() < 0.6) await neinMoment(false)
    else if (Math.random() < 0.05) await neinMoment(Math.random() < 0.3)
    else bark("loss", { voice: 0.3 })
  }
}

function buildCrew() {
  const root = new Container()
  root.x = -320
  root.y = 700
  const portrait = new Sprite(symbolTextures.get("captain"))
  portrait.anchor.set(0.5)
  portrait.scale.set(0.44)
  portrait.x = 80
  const bubble = new Container()
  bubble.x = 150
  const shape = new Graphics()
  const words = txt("", 26, 0x14100a, { stroke: false, shadow: false, ax: 0 })
  words.x = 22
  bubble.addChild(shape, words)
  root.addChild(portrait, bubble)
  world.addChild(root)
  ui.crew = { root, portrait, bubble, shape, words, timer: null }
}

function crewSay(symbol, text, opts = {}) {
  const crew = ui.crew
  if (!crew) return
  crew.portrait.texture = symbolTextures.get(symbol) || symbolTextures.get("captain")
  crew.words.text = text
  crew.words.style.fill = opts.color ?? 0x14100a
  const width = crew.words.width + 44
  crew.shape.clear()
  crew.shape.roundRect(0, -30, width, 60, 16).fill({ color: opts.bg ?? 0xf4ead2 }).stroke({ width: 3, color: 0x3a2a10 })
  crew.shape.poly([2, -10, -16, 4, 2, 10]).fill({ color: opts.bg ?? 0xf4ead2 })
  gsap.killTweensOf(crew.root)
  gsap.killTweensOf(crew.bubble.scale)
  if (crew.timer) crew.timer.kill()
  gsap.to(crew.root, { x: 30, duration: 0.4, ease: "back.out(1.8)" })
  gsap.fromTo(crew.bubble.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.35, delay: 0.15, ease: "back.out(3)" })
  gsap.fromTo(crew.portrait, { rotation: -0.12 }, { rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" })
  crew.timer = gsap.delayedCall(opts.hold ?? 2.2, () => gsap.to(crew.root, { x: -320, duration: 0.35, ease: "power2.in" }))
}

async function neinMoment(triple = false) {
  const layer = new Container()
  overlayLayer.addChild(layer)
  audio.sfx.nein(triple)
  const red = new Graphics().rect(0, 0, W, H).fill({ color: 0xff1a0a })
  red.alpha = 0
  red.blendMode = "add"
  layer.addChild(red)
  gsap.to(red, { alpha: 0.32, duration: 0.55, yoyo: true, repeat: 5, ease: "sine.inOut" })
  const beams = new Container()
  beams.x = ui.alarm.x
  beams.y = ui.alarm.y
  for (let i = 0; i < 2; i++) {
    const beam = new Sprite(textures.ray)
    beam.anchor.set(0.5, 0)
    beam.rotation = i * Math.PI
    beam.scale.set(1.6, 2.2)
    beam.tint = 0xff2a14
    beam.blendMode = "add"
    beam.alpha = 0.55
    beams.addChild(beam)
  }
  layer.addChild(beams)
  gsap.to(beams, { rotation: Math.PI * 6, duration: 3.2, ease: "none" })
  gsap.to(ui.alarm, { alpha: 1, duration: 0.12, yoyo: true, repeat: 13 })
  crewSay("captain", triple ? "NEIN! NEIN! NEIN!" : "NEIN!", { bg: 0x8a120a, color: 0xffffff, hold: 2.4 })
  const stamps = triple ? [0.32, 0.78, 1.25] : [0.32]
  stamps.forEach((delay, index) => {
    const stamp = new Sprite(art.titleTexture("NEIN!", 150, { spacing: 10, colors: ["#ffe2d8", "#ff3a24", "#4a0602"] }))
    stamp.anchor.set(0.5)
    stamp.x = W / 2 + (triple ? (index - 1) * 60 : 0)
    stamp.y = 380 + (triple ? index * 30 : 0)
    stamp.alpha = 0
    stamp.rotation = (Math.random() - 0.5) * 0.25
    layer.addChild(stamp)
    const size = 0.5 + index * 0.14
    gsap.delayedCall(delay, () => {
      stamp.alpha = 1
      shake(24 + index * 6, 0.5)
      screenFlash(0xff2a14, 0.5, 0.4)
      sparks(stamp.x, stamp.y, 30, [0xff6a3a, 0xffffff])
    })
    gsap.fromTo(stamp.scale, { x: 1.2, y: 1.2 }, { x: size, y: size, duration: 0.2, delay, ease: "power4.in" })
  })
  bark(triple ? "NEIN! NEIN! NEIN!" : "NEIN!")
  await waitForSkip(2.8)
  gsap.killTweensOf(beams)
  await tween(layer, { alpha: 0, duration: 0.4 })
  layer.destroy({ children: true })
}

function waitForSkip(seconds) {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      overlaySkip = null
      resolve()
    }
    overlaySkip = finish
    if (seconds) gsap.delayedCall(seconds, finish)
  })
}

function rayBurst(parent, tint = 0xffd27a) {
  const rays = new Container()
  for (let i = 0; i < 14; i++) {
    const ray = new Sprite(textures.ray)
    ray.anchor.set(0.5, 0)
    ray.rotation = (i / 14) * Math.PI * 2
    ray.scale.set(0.9, 0.8)
    ray.blendMode = "add"
    ray.tint = tint
    ray.alpha = 0.35
    rays.addChild(ray)
  }
  parent.addChild(rays)
  gsap.to(rays, { rotation: Math.PI * 2, duration: 18, repeat: -1, ease: "none" })
  return rays
}

async function bigWin(amount, forcedTitle) {
  const bet = Math.max(1, state.roundBet || state.bet)
  const ratio = amount / bet
  if (!forcedTitle && ratio < 15) return
  const steps = [[15, "GROSSER GEWINN"], [40, "RIESENGEWINN"], [100, "VERSENKT!"]]
  const finalIndex = forcedTitle ? steps.length - 1 : steps.filter(([edge]) => ratio >= edge).length - 1
  const prevSkip = state.skip
  state.skip = false
  setSpeed()
  const layer = new Container()
  overlayLayer.addChild(layer)
  const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x000000 })
  dim.alpha = 0
  layer.addChild(dim)
  gsap.to(dim, { alpha: 0.8, duration: 0.3 })
  const center = new Container()
  center.x = W / 2
  center.y = 380
  layer.addChild(center)
  const rays = rayBurst(center)
  const rays2 = rayBurst(center, 0xff8a4a)
  rays2.scale.set(0.7)
  gsap.to(rays2, { rotation: -Math.PI * 2, duration: 11, repeat: -1, ease: "none" })
  const heading = new Sprite(art.titleTexture(steps[0][1], 86, { spacing: 6 }))
  heading.anchor.set(0.5)
  heading.scale.set(0)
  center.addChild(heading)
  const value = txt("0", 120, 0xffffff, { font: SERIF, strokeWidth: 10, blur: 12 })
  value.y = 160
  center.addChild(value)
  const sub = txt("", 28, 0xffe08a, { strokeWidth: 3 })
  sub.y = 250
  center.addChild(sub)
  const seconds = Math.min(9, 3 + finalIndex * 2 + Math.log10(Math.max(10, ratio)) * 0.6)
  const theme = audio.winTheme(finalIndex + 2, seconds + 1)
  gsap.to(heading.scale, { x: 0.5, y: 0.5, duration: 0.6, ease: "back.out(2)" })
  gsap.to(heading, { y: -12, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" })
  let stage = 0
  const upgrade = (index) => {
    stage = index
    heading.texture = art.titleTexture(steps[index][1], 86, { spacing: 6 })
    gsap.fromTo(heading.scale, { x: 1.1, y: 1.1 }, { x: 0.5 + index * 0.06, y: 0.5 + index * 0.06, duration: 0.5, ease: "back.out(3)" })
    screenFlash(0xffe8b0, 0.6, 0.5)
    shake(14 + index * 6, 0.5)
    sparks(W / 2, 380, 80)
    particles.emit(textures.coin, W / 2, 400, { count: 40, speed: 900, scale: 0.5, life: 2, gravity: 900, spin: 10 })
    audio.sfx.impact(1)
    audio.shout(index === 2 ? "versenkt" : "treffer")
    crewSay(index === 2 ? "captain" : "officer", steps[index][1] + "!")
  }
  audio.shout("treffer", { delay: 0.2 })
  const proxy = { v: 0 }
  let ticker = 0
  const coins = setInterval(() => {
    particles.emit(textures.coin, W / 2 + (Math.random() - 0.5) * 500, 840, { count: 3 + stage * 2, speed: 950, angle: -Math.PI / 2, cone: 0.9, scale: 0.45, life: 2, gravity: 900, spin: 10 })
    ticker += 1
    if (ticker % 2 === 0) audio.sfx.countTick()
    if (ticker % 10 === 0) audio.sfx.coins(5)
  }, 60)
  const counting = gsap.to(proxy, {
    v: amount,
    duration: seconds,
    ease: "power1.inOut",
    onUpdate: () => {
      value.text = money(proxy.v)
      sub.text = `${Math.floor(proxy.v / bet)}× EINSATZ`
      const reached = steps.filter(([edge]) => proxy.v / bet >= edge).length - 1
      if (reached > stage && reached <= finalIndex) upgrade(reached)
    },
  })
  await waitForSkip(seconds)
  counting.progress(1)
  if (stage < finalIndex) upgrade(finalIndex)
  if (forcedTitle) {
    heading.texture = art.titleTexture(forcedTitle, 80, { spacing: 6 })
  }
  value.text = money(amount)
  sub.text = `${Math.floor(ratio)}× EINSATZ`
  clearInterval(coins)
  gsap.fromTo(value.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.5, ease: "back.out(3)" })
  sparks(W / 2, 540, 80)
  await waitForSkip(2)
  theme.stop()
  gsap.killTweensOf(rays)
  gsap.killTweensOf(rays2)
  gsap.killTweensOf(heading)
  await tween(layer, { alpha: 0, duration: 0.4 })
  layer.destroy({ children: true })
  state.skip = prevSkip
  setSpeed()
}

async function titleCard(title, subtitle, color, voiceLine) {
  const layer = new Container()
  overlayLayer.addChild(layer)
  const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x000000 })
  dim.alpha = 0
  layer.addChild(dim)
  gsap.to(dim, { alpha: 0.8, duration: 0.35 })
  const center = new Container()
  center.x = W / 2
  center.y = 420
  layer.addChild(center)
  rayBurst(center, color)
  const heading = new Sprite(art.titleTexture(title, 100, { spacing: 8, colors: color === SONAR_GREEN ? ["#e9ffef", "#5dff9a", "#0f5a30"] : undefined }))
  heading.anchor.set(0.5)
  heading.scale.set(0)
  center.addChild(heading)
  const sub = txt(subtitle, 34, 0xffffff, { strokeWidth: 4 })
  sub.y = 110
  sub.alpha = 0
  center.addChild(sub)
  const hint = txt("KLICKEN ODER LEERTASTE", 18, 0x9fb7c4, { stroke: false })
  hint.y = 200
  center.addChild(hint)
  gsap.to(hint, { alpha: 0.3, duration: 0.6, yoyo: true, repeat: -1 })
  gsap.to(heading.scale, { x: 0.5, y: 0.5, duration: 0.7, ease: "elastic.out(1, 0.5)" })
  gsap.to(sub, { alpha: 1, duration: 0.4, delay: 0.4 })
  if (voiceLine) audio.say(voiceLine)
  await waitForSkip(4)
  gsap.killTweensOf(hint)
  await tween(layer, { alpha: 0, duration: 0.4 })
  layer.destroy({ children: true })
}

async function sonarSweep() {
  const sweep = new Graphics()
  sweep.x = W / 2
  sweep.y = H / 2
  overlayLayer.addChild(sweep)
  audio.sfx.sweep()
  const proxy = { r: 0 }
  await tween(proxy, {
    r: 1100,
    duration: 0.9,
    ease: "power2.in",
    onUpdate: () => {
      sweep.clear().circle(0, 0, proxy.r).fill({ color: 0x041a0d, alpha: 0.96 }).stroke({ width: 18, color: SONAR_GREEN, alpha: 0.9 })
    },
  })
  return sweep
}

async function bonusIntro(mode) {
  bark(mode === "hunter" ? "hunter" : "pack")
  const spots = []
  state.grid.forEach((column, reel) => column.forEach((cell, row) => {
    if (cell.symbol === "sonar") spots.push(reels[reel].cellCenter(row))
  }))
  for (const spot of spots) {
    sonarRing(spot.x, spot.y)
    audio.sfx.sonar(3)
    await wait(0.28)
  }
  audio.sfx.alarm()
  for (let i = 0; i < 3; i++) gsap.delayedCall(i * 0.72, () => screenFlash(RED, 0.45, 0.5))
  await wait(1.6)
  const sweep = await sonarSweep()
  setBackground(mode)
  state.grid = engine.attract(mode)
  showGrid(state.grid)
  refreshHud()
  await tween(sweep, { alpha: 0, duration: 0.5 })
  sweep.destroy()
  if (mode === "hunter") {
    await titleCard("LEISE JAGD", "8 FREISPIELE  ·  SEHROHR AUF TROMMEL 3  ·  TREFFER = ×8", SONAR_GREEN, "Alarm! Leise Jagd! Sehrohr ausfahren!")
  } else {
    await titleCard("RUDELTAKTIK", "8 FREISPIELE  ·  TORPEDOS LADEN  ·  ALLE VIER ROHRE FEUERN", 0xff8a4a, "Rudeltaktik! Alle Rohre klar machen!")
    await deployLauncher()
  }
}

async function bonusOutro() {
  const total = state.roundWin
  const ratio = total / Math.max(1, state.roundBet)
  if (ratio >= 15) await bigWin(total)
  else if (ratio < 10) await neinMoment(true)
  if (ui.launcherOpen) await stowLauncher()
  await titleCard("JAGD BEENDET", `GESAMTGEWINN  ${money(total)}`, 0xffd27a, "Jagd beendet. Auftauchen!")
  const sweep = await sonarSweep()
  setBackground("base")
  await tween(sweep, { alpha: 0, duration: 0.5 })
  sweep.destroy()
}

function confirmBuy(mode, cost) {
  return new Promise((resolve) => {
    const layer = new Container()
    overlayLayer.addChild(layer)
    const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.7 })
    dim.eventMode = "static"
    layer.addChild(dim)
    const card = sized(art.panelTexture(620, 300, { radius: 20 }), 620, 300)
    card.x = W / 2 - 310
    card.y = 270
    layer.addChild(card)
    const head = txt(mode === "hunter" ? "LEISE JAGD KAUFEN?" : "RUDELTAKTIK KAUFEN?", 44, BRASS, { strokeWidth: 4 })
    head.x = W / 2
    head.y = 330
    const price = txt(`${money(cost)} Kredite  ·  8 Freispiele`, 28, 0xffffff, { strokeWidth: 3 })
    price.x = W / 2
    price.y = 390
    layer.addChild(head, price)
    const close = (answer) => {
      layer.destroy({ children: true })
      resolve(answer)
    }
    const yes = makeButton("JA, FEUER!", 220, 64, () => close(true), { size: 28, top: "#5a1a14", bottom: "#200605", rim: "#ff8a4a", color: 0xffffff })
    yes.x = W / 2 - 130
    yes.y = 490
    const no = makeButton("NEIN", 220, 64, () => close(false), { size: 28 })
    no.x = W / 2 + 130
    no.y = 490
    layer.addChild(yes, no)
    layer.alpha = 0
    gsap.to(layer, { alpha: 1, duration: 0.2 })
  })
}

function stepBet(direction) {
  if (state.busy || state.freeSpins || state.mode !== "base") return
  const index = BETS.indexOf(state.bet) + direction
  if (!BETS[index]) return
  state.bet = BETS[index]
  save()
  refreshHud()
  gsap.fromTo(ui.bet.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" })
}

function toggleAuto() {
  if (state.autoplay > 0) {
    state.autoplay = 0
    refreshHud()
    return
  }
  state.autoplay = 50
  refreshHud()
  if (!state.busy) onSpin()
}

function toggleTurbo() {
  state.turbo = !state.turbo
  save()
  setSpeed()
  refreshHud()
  bark(state.turbo ? "Turbo an. Volle Kraft!" : "Turbo aus. Halbe Fahrt.")
}

async function onSpin() {
  audio.unlock()
  if (overlaySkip) {
    overlaySkip()
    return
  }
  if (state.busy) {
    state.skip = true
    setSpeed()
    return
  }
  if (sheetOpen()) return
  state.busy = true
  state.skip = false
  setSpeed()
  refreshHud()
  gsap.to(ui.fire.ring, { rotation: ui.fire.ring.rotation + Math.PI * 2, duration: 0.8, ease: "power2.out" })
  try {
    await session(null)
  } finally {
    state.busy = false
    state.skip = false
    setSpeed()
    refreshHud()
  }
}

async function buy(mode) {
  audio.unlock()
  if (state.busy || state.mode !== "base" || state.freeSpins) return
  const cost = state.bet * BUY[mode]
  if (state.balance < cost) {
    bark("broke", { voice: 1 })
    return
  }
  state.busy = true
  refreshHud()
  const ok = await confirmBuy(mode, cost)
  if (!ok) {
    state.busy = false
    refreshHud()
    return
  }
  try {
    await session(mode)
  } finally {
    state.busy = false
    state.skip = false
    setSpeed()
    refreshHud()
  }
}

async function enterFeature(mode, sticky) {
  state.mode = mode
  state.freeSpins = 8
  state.sticky = sticky
  state.tubes = freshTubes()
  state.heights = null
  await bonusIntro(mode)
  setGauge(Math.max(1, sticky))
  refreshHud()
}

async function session(buying) {
  if (buying) {
    const cost = state.bet * BUY[buying]
    state.balance -= cost
    state.roundBet = state.bet
    state.roundWin = 0
    state.spinWin = 0
    save()
    refreshHud()
    await enterFeature(buying, 0)
  }
  let first = true
  while (true) {
    if (state.mode !== "base" && state.freeSpins > 0) {
      state.freeSpins -= 1
    } else {
      if (!first && state.autoplay <= 0) break
      if (state.balance < state.bet) {
        bark("broke", { voice: 1 })
        state.autoplay = 0
        break
      }
      state.balance -= state.bet
      state.roundBet = state.bet
      state.roundWin = 0
      state.sticky = 0
      state.tubes = freshTubes()
      if (state.autoplay > 0 && !first) state.autoplay -= 1
      save()
      setGauge(1, true)
    }
    first = false
    state.spinWin = 0
    ui.win.text = "0"
    refreshHud()
    const outcome = engine.spin({
      mode: state.mode,
      bet: state.roundBet || state.bet,
      sticky: state.sticky,
      tubes: state.tubes,
      roundWin: state.roundWin,
      heights: state.heights,
      maxWin: (state.roundBet || state.bet) * MAX_MULTIPLE,
    })
    await present(outcome)
    state.skip = false
    setSpeed()
    if (outcome.capped) {
      state.freeSpins = 0
      if (state.mode !== "base") await finishFeature()
      break
    }
    if (outcome.triggered && state.mode === "base") {
      await enterFeature(outcome.triggered, outcome.sticky)
      continue
    }
    if (state.mode !== "base") {
      state.sticky = outcome.sticky
      state.tubes = outcome.tubes
      state.heights = outcome.heights
      if (outcome.extraSpins) {
        state.freeSpins += outcome.extraSpins
        bark(`+${outcome.extraSpins} FREISPIELE!`, { voice: 1 })
        audio.sfx.sonar(4)
        gsap.fromTo(ui.infoValue.scale, { x: 2, y: 2 }, { x: 1, y: 1, duration: 0.5, ease: "back.out(3)" })
      }
      refreshHud()
      if (state.freeSpins > 0) {
        await wait(0.35)
        continue
      }
      await finishFeature()
      if (state.autoplay > 0) continue
      break
    }
    if (outcome.totalWin) await bigWin(outcome.totalWin)
    if (state.autoplay > 0) {
      await wait(0.35)
      continue
    }
    break
  }
  refreshHud()
}

async function finishFeature() {
  if (state.mode === "base") return
  await bonusOutro()
  state.mode = "base"
  state.heights = null
  state.sticky = 0
  state.tubes = freshTubes()
  setGauge(1)
  state.grid = engine.attract("base")
  showGrid(state.grid)
  refreshHud()
}

function sheetOpen() {
  return document.getElementById("sheet").classList.contains("open")
}

function openSheet() {
  const sheet = document.getElementById("sheet")
  sheet.classList.add("open")
  document.getElementById("music").checked = state.music
  document.getElementById("sfx").checked = state.sfx
  document.getElementById("voice").checked = state.voice
  document.getElementById("turbo").checked = state.turbo
  const table = document.getElementById("pays")
  if (table && !table.dataset.filled) {
    table.dataset.filled = "1"
    table.innerHTML = PAYING.slice().reverse().map((symbol) => {
      const row = PAYS[symbol].map((value) => (value / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 }))
      return `<tr><td>${TITLES[symbol]}</td><td>${row.join("</td><td>")}</td></tr>`
    }).join("")
  }
}

window.slot = {
  setMusic(on) {
    state.music = on
    audio.setMusic(on)
    save()
  },
  setSfx(on) {
    state.sfx = on
    audio.setSfx(on)
    save()
  },
  setVoice(on) {
    state.voice = on
    audio.setVoice(on)
    save()
    if (on) audio.say("Stimme an Bord.")
  },
  setTurbo(on) {
    state.turbo = on
    save()
    setSpeed()
    refreshHud()
  },
  applyCheat(raw) {
    const parts = raw.trim().toUpperCase().replace(/-/g, " ").split(/\s+/)
    if (parts[0] !== "KRAKEN") {
      audio.say("Nein!")
      return "Code abgelehnt. Nein."
    }
    const grant = parts[1] ? Math.min(Number(parts[1]) || 0, 5000000) : 50000
    if (!grant) return "Code abgelehnt. Nein."
    state.balance += grant
    save()
    refreshHud()
    bark("cheat", { voice: 1 })
    crewSay("officer", "Jawohl! Nachschub an Bord.")
    audio.sfx.win(3)
    gsap.fromTo(ui.balance.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.5, ease: "back.out(3)" })
    return `+${grant.toLocaleString("de-DE")} Kredite. Gut.`
  },
}

async function boot() {
  app = new Application()
  await app.init({
    preference: ["webgl", "canvas"],
    resizeTo: window,
    background: 0x020407,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  })
  document.body.appendChild(app.canvas)
  app.canvas.style.position = "fixed"
  app.canvas.style.inset = "0"

  const names = ["captain", "officer", "engineer", "radio", "cook", "sonar", "mine", "depth", "periscope", "torpedo", "uboat-bg", "bg-hunter", "bg-pack"]
  const loaded = await Promise.all(names.map(loadImage))
  names.forEach((name, index) => { if (loaded[index]) images.set(name, loaded[index]) })

  symbolTextures = art.buildSymbolTextures(images)
  textures = {
    glow: art.glowFrame(),
    dot: art.softDot("#ffffff", 48),
    flare: art.softDot("#ffe2a8", 128),
    fire: art.softDot("#ff9a40", 96),
    redGlow: art.softDot("#ff3a24", 96),
    greenGlow: art.softDot("#5dff9a", 64),
    amberGlow: art.softDot("#ffb347", 64),
    bubble: art.bubbleTexture(),
    smoke: art.smokeTexture(),
    ray: art.rayTexture(),
    coin: art.coinTexture(),
    vignette: art.vignetteTexture(),
    gauge: art.gaugeTexture(),
    torpedoSide: art.torpedoTexture(),
    ship: art.shipTexture(),
    seaView: seaViewTexture(),
    segments: [0, 1, 2, 3].map((index) => art.torpedoSegmentTexture(index)),
  }
  audio.preload(VOX)
  textures.fireButton = art.fireButtonTexture()

  buildBackground()
  buildWorld()
  fit()
  showGrid(state.grid)
  refreshHud()
  setGauge(1, true)

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && sheetOpen()) {
      document.getElementById("sheet").classList.remove("open")
      return
    }
    if (event.code === "Space" && !event.repeat && !sheetOpen()) {
      event.preventDefault()
      onSpin()
    }
  })
  app.stage.eventMode = "static"
  app.stage.hitArea = app.screen
  app.stage.on("pointertap", () => {
    audio.unlock()
    if (overlaySkip) overlaySkip()
  })

  let bubbleClock = 0
  let fitted = ""
  app.ticker.add((ticker) => {
    const size = `${app.screen.width}x${app.screen.height}`
    if (size !== fitted) {
      fitted = size
      fit()
    }
    const dt = Math.min(0.05, ticker.deltaMS / 1000)
    particles.update(dt)
    bubbleClock += dt
    if (bubbleClock > 0.35) {
      bubbleClock = 0
      const side = Math.random() < 0.5 ? 60 + Math.random() * 200 : W - 60 - Math.random() * 200
      particles.emit(textures.bubble, side, H - 120, { count: 1, speed: 40, scale: 0.2 + Math.random() * 0.3, life: 5, gravity: -30, drag: 1, wobble: 30, alpha: 0.5 })
    }
  })

  setInterval(() => {
    if (!state.busy && !overlaySkip && Math.random() < 0.3) bark("idle")
  }, 9000)

  document.getElementById("boot")?.remove()
  gsap.from(world, { alpha: 0, duration: 0.8 })
  reels.forEach((reel, index) => {
    gsap.from(reel.root, { y: reel.root.y - 60, alpha: 0, duration: 0.6, delay: 0.1 + index * 0.06, ease: "back.out(2)" })
  })
}

function seaViewTexture() {
  return art.canvasTexture(640, 640, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.52)
    sky.addColorStop(0, "#050b16")
    sky.addColorStop(1, "#1b2c3e")
    g.fillStyle = sky
    g.fillRect(0, 0, w, h * 0.52)
    g.fillStyle = "rgba(230,240,255,0.9)"
    g.beginPath()
    g.arc(w * 0.72, h * 0.2, 26, 0, Math.PI * 2)
    g.fill()
    const sea = g.createLinearGradient(0, h * 0.5, 0, h)
    sea.addColorStop(0, "#0f2232")
    sea.addColorStop(1, "#02070c")
    g.fillStyle = sea
    g.fillRect(0, h * 0.5, w, h * 0.5)
    g.strokeStyle = "rgba(180,210,230,0.18)"
    for (let i = 0; i < 40; i++) {
      const y = h * 0.52 + i * 8 + Math.random() * 4
      g.lineWidth = 1 + i * 0.05
      g.beginPath()
      g.moveTo(Math.random() * w * 0.3, y)
      g.lineTo(w * (0.5 + Math.random() * 0.5), y)
      g.stroke()
    }
    g.fillStyle = "rgba(255,255,255,0.12)"
    g.fillRect(w * 0.62, h * 0.52, 60, h * 0.4)
  })
}

boot().catch((error) => {
  const note = document.createElement("pre")
  note.style.cssText = "position:fixed;inset:48px;margin:0;color:#f4efe4;font:18px/1.4 monospace;white-space:pre-wrap;z-index:9"
  note.textContent = String(error && error.stack || error)
  document.body.appendChild(note)
})
