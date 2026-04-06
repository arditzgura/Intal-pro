const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';

  // Ikona — nëse ekziston, përdore; ndryshe lëre Electron të zgjedhë
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  const iconOpt  = fs.existsSync(iconPath) ? iconPath : undefined;

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
      webSecurity: false,      // lejon burime lokale (logo, watermark, fontet)
      allowRunningInsecureContent: false,
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
