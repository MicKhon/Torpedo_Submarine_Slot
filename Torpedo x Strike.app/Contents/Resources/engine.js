export const PAYING = ["ten", "jack", "queen", "king", "ace", "cook", "radio", "engineer", "officer", "captain"]
export const WILDS = new Set(["mine", "depth", "periscope", "torpedo"])
export const PAYS = {
  ten: [9, 11, 23, 63],
  jack: [9, 13, 27, 90],
  queen: [9, 14, 31, 90],
  king: [11, 16, 32, 126],
  ace: [11, 16, 36, 126],
  cook: [13, 18, 40, 144],
  radio: [13, 22, 54, 180],
  engineer: [14, 23, 72, 216],
  officer: [18, 27, 144, 450],
  captain: [40, 135, 270, 900],
}
const REEL_WEIGHTS = [
  ["ten", 120], ["jack", 110], ["queen", 100], ["king", 90], ["ace", 74],
  ["cook", 48], ["radio", 40], ["engineer", 32], ["officer", 22], ["captain", 14],
]
const LAUNCH_WEIGHTS = [
  ["ten", 4], ["jack", 8], ["queen", 10], ["king", 14], ["ace", 16],
  ["cook", 16], ["radio", 18], ["engineer", 18], ["officer", 20], ["captain", 22],
]

export const TITLES = {
  ten: "10", jack: "J", queen: "Q", king: "K", ace: "A",
  cook: "KOCH", radio: "FUNKER", engineer: "MASCHINIST", officer: "OFFIZIER", captain: "KAPITÄN",
  sonar: "SONAR", mine: "MINE", depth: "TIEFE", periscope: "SEHROHR", torpedo: "TORPEDO",
}

export function heightsFor(mode) {
  return mode === "hunter" ? [2, 3, 8, 4, 3, 2] : [2, 3, 4, 4, 3, 2]
}

export const MAX_ROWS = 7

export function freshTubes() {
  return [0, 0, 0, 0]
}

function payHundredths(symbol, reels) {
  const row = PAYS[symbol]
  if (!row || reels < 3 || reels > 6) return 0
  return row[reels - 3]
}

export function evaluate(grid, bet, multiplier) {
  const mult = Math.max(1, multiplier)
  const wins = []
  for (const symbol of PAYING) {
    const win = winFor(symbol, grid, bet, mult)
    if (win) wins.push(win)
  }
  return wins
}

function winFor(symbol, grid, bet, multiplier) {
  let reelCount = 0
  let ways = 1
  let positions = []
  let natural = false
  for (let reel = 0; reel < grid.length; reel++) {
    const hit = contribution(symbol, reel, grid)
    if (hit.ways === 0) break
    reelCount += 1
    ways *= hit.ways
    positions = positions.concat(hit.positions)
    natural = natural || hit.natural
  }
  if (reelCount < 3 || !natural || ways <= 0) return null
  const hundredths = payHundredths(symbol, reelCount)
  const amount = Math.floor((bet * hundredths * ways * multiplier) / 100)
  if (amount <= 0) return null
  return { symbol, reels: reelCount, ways, amount, positions }
}

function contribution(symbol, reel, grid) {
  let ways = 0
  const positions = []
  let natural = false
  let expands = false
  const column = grid[reel]
  for (let row = 0; row < column.length; row++) {
    const cell = column[row]
    const matches = cell.symbol === symbol || WILDS.has(cell.symbol)
    if (!matches) continue
    if (!(cell.ways > 0 || cell.reelStack)) continue
    if (cell.ways > 0) {
      ways += cell.ways
      if (cell.symbol === symbol) natural = true
    }
    positions.push({ reel, row })
    if (cell.reelStack) expands = true
  }
  return {
    ways,
    natural,
    positions: expands && ways > 0 ? column.map((_, row) => ({ reel, row })) : positions,
  }
}

export function depthMultiplier(grid) {
  return grid.reduce((sum, reel) => sum + Math.max(0, ...reel.map((cell) => cell.depthMultiplier || 0)), 0)
}

export function displayedWays(grid) {
  return grid.reduce((product, reel) => product * Math.max(1, reel.reduce((sum, cell) => sum + Math.max(0, cell.ways), 0)), 1)
}

let seq = 1
function cell(symbol, extra = {}) {
  return { id: seq++, symbol, ways: 1, depthMultiplier: 0, reelStack: false, ...extra }
}

export function createEngine(seed) {
  let state = seed || (Math.floor(Math.random() * 0xffffffff) || 1)
  const next = () => {
    state = (state + 0x9e3779b9) >>> 0
    let z = state
    z = Math.imul(z ^ (z >>> 16), 0x7feb352d)
    z = Math.imul(z ^ (z >>> 15), 0x846ca68b)
    return ((z ^ (z >>> 16)) >>> 0) / 4294967296
  }
  const chance = (p) => next() < p
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1))
  const pick = (weights) => {
    const total = weights.reduce((sum, pair) => sum + pair[1], 0)
    let roll = Math.floor(next() * total)
    for (const [symbol, weight] of weights) {
      if (roll < weight) return symbol
      roll -= weight
    }
    return weights[0][0]
  }

  function blankGrid(mode, heights) {
    return (heights || heightsFor(mode)).map((height) => Array.from({ length: height }, () => cell(pick(REEL_WEIGHTS))))
  }

  function payingRows(grid, reel) {
    const rows = []
    grid[reel].forEach((item, row) => {
      if (PAYING.includes(item.symbol)) rows.push(row)
    })
    return rows
  }

  function overwrite(grid, reel, make) {
    const rows = payingRows(grid, reel)
    if (!rows.length) return
    const row = rows[int(0, rows.length - 1)]
    grid[reel][row] = make()
  }

  function randomSpot(grid) {
    const spots = []
    grid.forEach((column, reel) => column.forEach((item, row) => {
      if (PAYING.includes(item.symbol)) spots.push({ reel, row })
    }))
    if (!spots.length) return null
    return spots[int(0, spots.length - 1)]
  }

  function attract(mode) {
    return heightsFor(mode).map((height, reel) => Array.from({ length: height }, (_, row) => cell(PAYING[(reel * 3 + row) % PAYING.length])))
  }

  function spin(input) {
    const mode = input.mode
    const heights = mode !== "base" && input.heights && input.heights.length === 6 ? input.heights.slice() : heightsFor(mode)
    const grid = blankGrid(mode, heights)
    const notes = []
    const sonarChance = mode === "base" ? 0.112 : 0.07
    for (let reel = 1; reel <= 4; reel++) {
      if (chance(sonarChance)) overwrite(grid, reel, () => cell("sonar"))
    }
    if (chance(0.075)) {
      const spot = randomSpot(grid)
      if (spot) {
        grid[spot.reel][spot.row] = cell("mine")
        if (chance(0.22)) {
          const second = randomSpot(grid)
          if (second) grid[second.reel][second.row] = cell("mine")
        }
      }
    }
    const depthReels = mode === "hunter" ? [3] : [2, 3]
    const plans = []
    for (const reel of depthReels) {
      if (grid[reel].length < 4 || !chance(0.082)) continue
      const visible = int(1, 4)
      const steps = 4 - visible
      const multiplier = 1 + steps
      const fromTop = chance(0.5)
      const rows = fromTop ? [...Array(visible).keys()] : [...Array(visible).keys()].map((i) => 4 - visible + i)
      for (const row of rows) grid[reel][row] = cell("depth", { depthMultiplier: steps === 0 ? multiplier : 0 })
      if (steps === 0) notes.push(`Tiefe auf Trommel ${reel + 1} · ×${multiplier}`)
      plans.push({ reel, steps, multiplier })
    }
    let shared = null
    for (const reel of [1, 4]) {
      if (!chance(0.125)) continue
      if (!shared) shared = pick(REEL_WEIGHTS)
      const size = int(2, 3)
      overwrite(grid, reel, () => cell(shared, { ways: size }))
      notes.push(`Strömung Trommel ${reel + 1}: ${TITLES[shared]} ×${size}`)
    }
    if (mode === "hunter" && chance(0.24)) overwrite(grid, 2, () => cell("periscope"))
    if (mode === "pack") {
      for (let reel = 1; reel <= 4; reel++) {
        if (chance(0.24)) overwrite(grid, reel, () => cell("torpedo"))
      }
    }

    const events = [{ type: "landed", grid: clone(grid), notes }]
    for (const plan of plans) {
      if (plan.steps <= 0) continue
      for (let row = 0; row < grid[plan.reel].length; row++) {
        grid[plan.reel][row] = cell("depth", { depthMultiplier: plan.multiplier })
      }
      events.push({ type: "nudged", reel: plan.reel, steps: plan.steps, multiplier: plan.multiplier, grid: clone(grid) })
    }

    let tubes = input.tubes && input.tubes.length === 4 ? input.tubes.slice() : freshTubes()
    let sticky = input.sticky || 0
    let spinMult = 0
    let total = 0
    const seen = new Set()
    const fired = new Set()
    let scopeResolved = false
    let capped = false
    const roomStart = Math.max(0, input.maxWin - (input.roundWin || 0))

    const absorb = () => {
      for (const column of grid) for (const item of column) if (item.symbol === "sonar") seen.add(item.id)
    }
    absorb()

    for (let step = 0; step < 8 && !capped; step++) {
      if (mode === "hunter" && !scopeResolved) {
        const fresh = grid[2].filter((item) => item.symbol === "periscope" && !fired.has(item.id))
        if (fresh.length && hasAim(grid)) {
          fresh.forEach((item) => fired.add(item.id))
          const hit = chance(0.5)
          if (hit) {
            sticky += 1
            for (let row = 0; row < grid[2].length; row++) {
              const made = cell("periscope", { depthMultiplier: 8 })
              grid[2][row] = made
              fired.add(made.id)
            }
          }
          events.push({ type: "scope", hit, grid: clone(grid) })
          scopeResolved = true
        }
      }

      if (mode === "pack") {
        const bombBonus = grid.some((column) => column.some((item) => item.symbol === "mine")) ? 1 : 0
        let changed = false
        for (let reel = 1; reel <= 4; reel++) {
          const parts = grid[reel].filter((item) => item.symbol === "torpedo").length
          for (let n = 0; n < parts; n++) {
            const index = reel - 1
            const base = tubes[index] === 0 ? 2 : 1
            tubes[index] = Math.min(9, tubes[index] + base + bombBonus)
            changed = true
          }
        }
        if (changed) events.push({ type: "charged", tubes: tubes.slice() })
        if (tubes.every((value) => value > 0)) {
          const symbol = pick(LAUNCH_WEIGHTS)
          const charges = tubes.slice()
          ;[1, 2, 3, 4].forEach((reel, offset) => {
            const wildReel = reel === 2 || reel === 3
            for (let row = 0; row < grid[reel].length; row++) {
              grid[reel][row] = wildReel
                ? cell("depth", { ways: row === 0 ? charges[offset] : 0, reelStack: true })
                : cell(symbol, { ways: row === 0 ? charges[offset] : 0, reelStack: true })
            }
          })
          sticky += 1
          tubes = freshTubes()
          events.push({ type: "launched", symbol, charges, grid: clone(grid), sticky })
        }
      }

      const multiplier = Math.max(1, sticky + spinMult + depthMultiplier(grid))
      const lines = evaluate(grid, input.bet, multiplier)
      const raw = lines.reduce((sum, line) => sum + line.amount, 0)
      const winPositions = new Set(lines.flatMap((line) => line.positions.map((pos) => `${pos.reel}:${pos.row}`)))
      if (raw > 0) {
        const room = Math.max(0, roomStart - total)
        const paid = Math.min(raw, room)
        total += paid
        events.push({ type: "scored", lines, paid, multiplier })
        if (total >= roomStart) {
          capped = true
          events.push({ type: "abyss" })
          break
        }
      }
      const mines = []
      grid.forEach((column, reel) => column.forEach((item, row) => {
        if (item.symbol === "mine") mines.push({ reel, row })
      }))
      if (!lines.length && !mines.length) break
      if (mines.length) {
        if (mode === "base") spinMult += mines.length
        else sticky += mines.length
        events.push({ type: "blasted", mines: mines.length, multiplier: Math.max(1, sticky + spinMult) })
      }
      const remove = new Set()
      for (const key of winPositions) {
        const [reel, row] = key.split(":").map(Number)
        if (grid[reel][row].symbol !== "sonar") remove.add(key)
      }
      if (mines.length) {
        grid.forEach((column, reel) => column.forEach((item, row) => {
          const key = `${reel}:${row}`
          if (item.symbol === "mine") remove.add(key)
          else if (!WILDS.has(item.symbol) && item.symbol !== "sonar" && !winPositions.has(key)) remove.add(key)
        }))
      }
      if (!remove.size) break
      if (mines.length && mode === "pack") {
        const grown = []
        for (const reel of new Set(mines.map((spot) => spot.reel))) {
          if (heights[reel] < MAX_ROWS) {
            heights[reel] += 1
            grown.push(reel)
          }
        }
        if (grown.length) events.push({ type: "expanded", reels: grown, heights: heights.slice() })
      }
      for (let reel = 0; reel < grid.length; reel++) {
        const kept = grid[reel].filter((_, row) => !remove.has(`${reel}:${row}`))
        const missing = heights[reel] - kept.length
        const fresh = Array.from({ length: missing }, () => cell(pick(REEL_WEIGHTS)))
        grid[reel] = fresh.concat(kept)
      }
      absorb()
      events.push({ type: "fell", grid: clone(grid) })
    }

    const sonarCount = seen.size
    let triggered = null
    let extra = 0
    if (!capped) {
      if (mode === "base") {
        if (sonarCount >= 4) triggered = "pack"
        else if (sonarCount >= 3) triggered = "hunter"
        if (triggered) sticky += spinMult
      } else extra = sonarCount * 2
    }
    return {
      events,
      totalWin: total,
      finalGrid: clone(grid),
      triggered,
      extraSpins: extra,
      sticky,
      tubes: mode === "pack" ? tubes : freshTubes(),
      heights,
      capped,
      sonarCount,
    }
  }

  return { spin, attract }
}

function hasAim(grid) {
  return PAYING.some((symbol) => connects(symbol, 0, grid) && connects(symbol, 1, grid))
}

function connects(symbol, reel, grid) {
  return grid[reel].some((item) => item.ways > 0 && (item.symbol === symbol || WILDS.has(item.symbol)))
}

function clone(grid) {
  return grid.map((column) => column.map((item) => ({ ...item })))
}

export function selfCheck() {
  const grid = [
    [cell("captain"), cell("ten")],
    [cell("captain"), cell("jack"), cell("queen")],
    [cell("captain"), cell("ace"), cell("cook"), cell("king")],
    [cell("officer"), cell("radio"), cell("engineer"), cell("cook")],
    [cell("ten"), cell("jack"), cell("queen")],
    [cell("ace"), cell("king")],
  ]
  const wins = evaluate(grid, 100, 1)
  if (wins.length !== 1 || wins[0].amount !== 40) throw new Error(`captain pay ${wins.map((w) => w.amount)}`)
}
