const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  getPrinters:  () => ipcRenderer.invoke('get-printers'),
  shareFile:    (buffer, fileName) => ipcRenderer.invoke('share-file', { buffer, fileName }),
});
