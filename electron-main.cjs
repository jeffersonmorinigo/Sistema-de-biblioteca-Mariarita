const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startEmbeddedServer, getLocalIps } = require('./electron/server.cjs');

const isDev = process.env.NODE_ENV === 'development';
let embeddedServer = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Sistema de Biblioteca - Maria Rita',
    autoHideMenuBar: true,
    icon: isDev
      ? path.join(__dirname, 'public', 'logo.png')
      : path.join(__dirname, 'dist', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron', 'preload.js'),
    },
  });

  mainWindow.maximize();

  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // Inicia servidor embutido HTTP/HTTPS para permitir acesso de celulares na rede local
  const distPath = path.join(__dirname, 'dist');
  try {
    embeddedServer = startEmbeddedServer(distPath, {
      httpsPort: 8080,
      httpPort: 8081,
    });
  } catch (err) {
    console.error('[ElectronMain] Falha ao iniciar servidor embutido para celulares:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Fornece ao frontend React os IPs locais e as portas ativas para o QR Code
ipcMain.handle('get-network-info', () => {
  const ips = getLocalIps();
  const primaryIp = ips[0]?.address || '192.168.100.2';
  return {
    ips,
    primaryIp,
    httpsPort: embeddedServer?.httpsPort || 8080,
    httpPort: embeddedServer?.httpPort || 8081,
  };
});

ipcMain.on('quit-app', () => {
  app.quit();
});

app.on('window-all-closed', () => {
  if (embeddedServer) {
    embeddedServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});