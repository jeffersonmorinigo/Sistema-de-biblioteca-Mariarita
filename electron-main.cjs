const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { startEmbeddedServer, getLocalIps } = require('./electron/server.cjs');
const { getHardwareId, loadSavedLicense, saveLicenseFile } = require('./electron/machineId.cjs');
const { checkUpdates, downloadAndInstall } = require('./electron/updater.cjs');

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

// Fornece a identificação estável e única do Hardware (antiópia)
ipcMain.handle('get-machine-id', () => {
  return getHardwareId();
});

// Lê a licença gravada em arquivo seguro do sistema
ipcMain.handle('load-saved-license', () => {
  return loadSavedLicense(app);
});

// Salva a licença em arquivo seguro do sistema
ipcMain.handle('save-license-file', (_event, licenseKey) => {
  return saveLicenseFile(app, licenseKey);
});

// Verifica se há novas atualizações do software
ipcMain.handle('check-for-updates', async () => {
  try {
    return await checkUpdates(app.getVersion());
  } catch (err) {
    return {
      updateAvailable: false,
      error: err.message,
      currentVersion: app.getVersion(),
    };
  }
});

// Baixa e instala a atualização automaticamente
ipcMain.handle('download-and-install-update', async (event, downloadUrl) => {
  return await downloadAndInstall(downloadUrl, (percent) => {
    event.sender.send('update-download-progress', percent);
  });
});

// Retorna a versão atual do app instalada
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Abre URLs externas no navegador padrão
ipcMain.handle('open-external-url', (_event, url) => {
  if (url) {
    shell.openExternal(url);
    return true;
  }
  return false;
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