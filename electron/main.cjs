const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // avoids white flash
    webPreferences: {
      contextIsolation: true
    }
  })

  // Load Vite build
  win.loadFile(path.join(__dirname, '../dist/index.html'))

  // Set zoom factor & limits
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1)                     // default zoom
    win.webContents.setVisualZoomLevelLimits(0.85, 1.25) // min/max zoom
  })

  win.once('ready-to-show', () => {
    win.show() // <-- removed the extra '-' which was a typo
  })

  // OPTIONAL: open devtools during testing
  // win.webContents.openDevTools()
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
