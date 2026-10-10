const http = require("http")
const fs = require("fs")
const path = require("path")

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
}

function start(rootDir) {
  const root = path.resolve(rootDir)
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1")
    let name = decodeURIComponent(url.pathname).replace(/^\/+/, "")
    if (!name) name = "index.html"
    const file = path.resolve(root, name)
    const relative = path.relative(root, file)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      res.writeHead(403)
      res.end()
      return
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
        res.end("Not found")
        return
      }
      const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream"
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": data.length,
        "Cache-Control": "no-cache",
      })
      res.end(data)
    })
  })
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      resolve({ server, port: address.port })
    })
  })
}

module.exports = { start }
