const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';

  // Ikona — nëse ekziston, përdore; ndryshe lëre Electron të zgjedhë
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  const iconOpt  = fs.existsSync(iconPath) ? iconPath : undefined;

  const preloadPath = path.join(__dirname, 'preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'INTAL PRO — Sistemi i Faturimit',
    ...(iconOpt ? { icon: iconOpt } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: false,
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
    },
    backgroundColor: '#f8fafc',
    show: false,
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Shfaq dritaren vetëm kur faqja është gati — pa "flash" të bardhë
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Linqet e jashtme → browser i sistemit
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── IPC: Ruaj PNG në Downloads dhe hap folderin ──────────────────────────────
ipcMain.handle('save-to-downloads', async (_event, { buffer, fileName }) => {
  const os       = require('os');
  const downloads = path.join(os.homedir(), 'Downloads');
  const filePath  = path.join(downloads, fileName);
  fs.writeFileSync(filePath, Buffer.from(buffer));
  shell.showItemInFolder(filePath); // hap Downloads me skedarin e zgjedhur
  return { success: true, path: filePath };
});

// ─── IPC: Print me dialog zgjedhje printeri ───────────────────────────────────
ipcMain.handle('print-with-dialog', async (_event, options) => {
  if (!mainWindow) return { success: false, error: 'No window' };
  return new Promise((resolve) => {
    const printOptions = {
      silent: false,        // hap dialog
      printBackground: true,
      color: options.color !== false,
      margins: { marginType: 'none' },
    };
    if (options.pageSize) printOptions.pageSize = options.pageSize;
    mainWindow.webContents.print(printOptions, (success, errorType) => {
      resolve({ success, error: errorType });
    });
  });
});

// Merr listën e printerëve
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  return mainWindow.webContents.getPrintersAsync();
});

// Hiq menunë e Electron-it (File, Edit, View, etj.)
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
