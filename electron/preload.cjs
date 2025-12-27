const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  setZoom: (zoom) => ipcRenderer.invoke('set-zoom', zoom)
})
