const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveToDesktop:   (buffer, fileName) => ipcRenderer.invoke('save-to-desktop', { buffer, fileName }),
  shareImage:      (buffer, fileName) => ipcRenderer.invoke('share-image',     { buffer, fileName }),
  savePdf:         (buffer, fileName) => ipcRenderer.invoke('save-pdf',        { buffer, fileName }),
  printWithDialog: (options)          => ipcRenderer.invoke('print-with-dialog', options),
  getPrinters:     ()                 => ipcRenderer.invoke('get-printers'),
  // File-based data persistence
  dbRead:  ()     => ipcRenderer.invoke('db-read'),
  dbWrite: (json) => ipcRenderer.invoke('db-write', json),
  dbPath:  ()     => ipcRenderer.invoke('db-path'),
});
