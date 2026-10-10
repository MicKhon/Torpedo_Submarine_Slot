const { app, BrowserWindow, shell } = require("electron")
const path = require("path")
const { start } = require("./server")

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let host = null

function gameRoot() {
  return path.join(__dirname, "game")
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#020407",
    title: "Torpedo x Strike",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: "no-user-gesture-required",
    },
  })
  win.setMenuBarVisibility(false)
  win.removeMenu()
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1:") || url.startsWith("http://localhost:")) {
      return { action: "allow" }
    }
    shell.openExternal(url)
    return { action: "deny" }
  })
  win.webContents.on("will-navigate", (event, url) => {
    const local = `http://127.0.0.1:${port}/`
    if (!url.startsWith(local) && !url.startsWith(`http://localhost:${port}/`)) {
      event.preventDefault()
    }
  })
  const smoke = process.argv.includes("--smoke")
  win.webContents.on("did-fail-load", (_event, code, description) => {
    console.error("LOAD_FAIL", code, description)
    if (smoke) app.exit(1)
  })
  win.webContents.on("did-finish-load", async () => {
    if (!smoke) return
    const started = Date.now()
    let ready = false
    let boot = ""
    while (Date.now() - started < 8000) {
      const state = await win.webContents.executeJavaScript(`({
        title: document.title,
        canvas: !!document.querySelector("canvas"),
        boot: (document.getElementById("boot") || {}).textContent || ""
      })`)
      boot = state.boot
      if (state.canvas) {
        ready = true
        console.log("SMOKE_OK", state.title)
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    if (!ready) {
      console.error("SMOKE_FAIL", boot)
      app.exit(1)
      return
    }
    app.quit()
  })
  win.loadURL(`http://127.0.0.1:${port}/index.html`)
  return win
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.local.torpedobay")
  host = await start(gameRoot())
  createWindow(host.port)
})

app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.on("window-all-closed", () => {
  if (host) host.server.close()
  app.quit()
})
