const fs = require("fs")
const path = require("path")

const from = path.resolve(__dirname, "../TorpedoBay/Web")
const to = path.join(__dirname, "game")
const keep = new Set([".html", ".jpg", ".jpeg", ".png", ".wav"])

fs.rmSync(to, { recursive: true, force: true })
fs.mkdirSync(to, { recursive: true })

for (const name of fs.readdirSync(from)) {
  const source = path.join(from, name)
  if (!fs.statSync(source).isFile()) continue
  const ext = path.extname(name).toLowerCase()
  if (name !== "game.js" && !keep.has(ext)) continue
  fs.copyFileSync(source, path.join(to, name))
}

const staged = fs.readdirSync(to)
if (!staged.includes("index.html") || !staged.includes("game.js")) {
  throw new Error("В игре нет index.html или game.js")
}
