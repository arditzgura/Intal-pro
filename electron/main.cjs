const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');

// Aktivizo print preview të Chromium brenda Electron
app.commandLine.appendSwitch('enable-print-preview');
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

const os = require('os');
const { exec } = require('child_process');

// ─── IPC: Ruaj PNG në Desktop (pa share) ─────────────────────────────────────
ipcMain.handle('save-to-desktop', async (_event, { buffer, fileName }) => {
  const filePath = path.join(os.homedir(), 'Desktop', fileName);
  fs.writeFileSync(filePath, Buffer.from(buffer));
  return { success: true, path: filePath };
});

// ─── IPC: Ruaj PNG në Desktop + hap Windows Share Sheet ─────────────────────
ipcMain.handle('share-image', async (_event, { buffer, fileName }) => {
  const { clipboard, nativeImage } = require('electron');
  const filePath = path.join(os.homedir(), 'Desktop', fileName);
  const buf = Buffer.from(buffer);
  fs.writeFileSync(filePath, buf);
  try { clipboard.writeImage(nativeImage.createFromBuffer(buf)); } catch {}

  const escaped = filePath.replace(/\\/g, '\\\\');
  const ps = `
    Add-Type -AssemblyName Windows.Storage
    $file = [Windows.Storage.StorageFile]::GetFileFromPathAsync('${escaped}').GetAwaiter().GetResult()
    $mgr  = [Windows.ApplicationModel.DataTransfer.DataTransferManager]::GetForCurrentView()
    $mgr.add_DataRequested({
      param($s,$e)
      $e.Request.Data.SetBitmap([Windows.Storage.Streams.RandomAccessStreamReference]::CreateFromFile($file))
      $e.Request.Data.Properties.Title = '${fileName}'
    })
    [Windows.ApplicationModel.DataTransfer.DataTransferManager]::ShowShareUI()
  `;
  exec(`powershell -NoProfile -WindowStyle Hidden -Command "${ps.replace(/\r?\n/g,' ')}"`, () => {});
  return { success: true, path: filePath };
});

// ─── IPC: Ruaj PDF në Desktop ─────────────────────────────────────────────────
ipcMain.handle('save-pdf', async (_event, { buffer, fileName }) => {
  const filePath = path.join(os.homedir(), 'Desktop', fileName);
  fs.writeFileSync(filePath, Buffer.from(buffer));
  shell.showItemInFolder(filePath);
  return { success: true, path: filePath };
});

// ─── IPC: Print me dialog (print preview e Chromium) ─────────────────────────
ipcMain.handle('print-with-dialog', async (_event, options) => {
  if (!mainWindow) return { success: false };
  return new Promise((resolve) => {
    const opts = {
      silent: false,
      printBackground: true,
      color: options.color !== false,
      margins: { marginType: 'printableArea' },
    };
    if (options.pageSize) opts.pageSize = options.pageSize;
    mainWindow.webContents.print(opts, (success, err) => resolve({ success, err }));
  });
});

// ─── IPC: Merr listën e printerëve ───────────────────────────────────────────
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
