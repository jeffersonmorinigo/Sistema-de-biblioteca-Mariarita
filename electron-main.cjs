const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { startEmbeddedServer, getLocalIps } = require('./electron/server.cjs');
const { getHardwareId, loadSavedLicense, saveLicenseFile } = require('./electron/machineId.cjs');
const { checkUpdates, downloadAndInstall, downloadAndApplyOta, getActiveDistInfo } = require('./electron/updater.cjs');

const isDev = process.env.NODE_ENV === 'development';
let embeddedServer = null;
let mainWindow = null;
let autoUpdateRunning = false;

function createWindow() {
  const activeDist = getActiveDistInfo(app);

  mainWindow = new BrowserWindow({
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
    mainWindow.loadFile(path.join(activeDist.dir, 'index.html'));
  }
}

/**
 * Rotina de atualização em segundo plano (OTA) sem necessidade de reinstalar o .exe
 */
async function runSilentAutoUpdateCheck() {
  if (autoUpdateRunning) return;
  autoUpdateRunning = true;
  try {
    const activeDist = getActiveDistInfo(app);
    const update = await checkUpdates(activeDist.version);
    if (update && update.updateAvailable && update.distUrl) {
      console.log(`[AutoUpdate] Atualização OTA v${update.latestVersion} encontrada. Baixando pacote em segundo plano...`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ota-update-downloading', {
          version: update.latestVersion,
          notes: update.releaseNotes,
        });
      }

      await downloadAndApplyOta(update.distUrl, update.latestVersion, (percent) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-download-progress', percent);
        }
      });

      console.log(`[AutoUpdate] Versão v${update.latestVersion} instalada e pronta em segundo plano!`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ota-update-ready', {
          version: update.latestVersion,
          notes: update.releaseNotes,
        });
      }
    }
  } catch (err) {
    console.warn('[AutoUpdate] Verificação em segundo plano:', err.message);
  } finally {
    autoUpdateRunning = false;
  }
}

function startAutoUpdateScheduler() {
  // Verifica 5 segundos após iniciar
  setTimeout(runSilentAutoUpdateCheck, 5000);
  // E checa a cada 15 minutos enquanto o app estiver aberto
  setInterval(runSilentAutoUpdateCheck, 15 * 60 * 1000);
}

app.whenReady().then(() => {
  const activeDist = getActiveDistInfo(app);
  try {
    embeddedServer = startEmbeddedServer(activeDist.dir, {
      httpsPort: 8080,
      httpPort: 8081,
    });
  } catch (err) {
    console.error('[ElectronMain] Falha ao iniciar servidor embutido para celulares:', err);
  }

  createWindow();
  startAutoUpdateScheduler();

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

// Fornece a identificação estável e única do Hardware (anti-cópia)
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
    const activeDist = getActiveDistInfo(app);
    return await checkUpdates(activeDist.version);
  } catch (err) {
    const activeDist = getActiveDistInfo(app);
    return {
      updateAvailable: false,
      error: err.message,
      currentVersion: activeDist.version,
    };
  }
});

// Baixa e instala a atualização OTA (Over-The-Air) leve sem precisar reinstalar o executável
ipcMain.handle('apply-ota-update', async (event, distUrl, version) => {
  return await downloadAndApplyOta(distUrl, version, (percent) => {
    event.sender.send('update-download-progress', percent);
  });
});

// Baixa e instala a atualização completa por executável (fallback silencioso)
ipcMain.handle('download-and-install-update', async (event, downloadUrl) => {
  return await downloadAndInstall(downloadUrl, (percent) => {
    event.sender.send('update-download-progress', percent);
  });
});

// Retorna a versão atual ativa (seja da atualização OTA ou empacotada)
ipcMain.handle('get-app-version', () => {
  const activeDist = getActiveDistInfo(app);
  return activeDist.version;
});

// Reinicia o sistema imediatamente para carregar os novos arquivos
ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit(0);
  return true;
});

// Recarrega o frontend com a versão mais recente em tempo real
ipcMain.handle('reload-active-dist', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const activeDist = getActiveDistInfo(app);
    mainWindow.loadFile(path.join(activeDist.dir, 'index.html'));
    return true;
  }
  return false;
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
