const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printWithDialog: (options) => ipcRenderer.invoke('print-with-dialog', options),
  getPrinters:     () => ipcRenderer.invoke('get-printers'),
  saveToDownloads: (buffer, fileName) => ipcRenderer.invoke('save-to-downloads', { buffer, fileName }),
});
