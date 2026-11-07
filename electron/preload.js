const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  quitApp: () => ipcRenderer.send('quit-app'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  reloadActiveDist: () => ipcRenderer.invoke('reload-active-dist'),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  loadSavedLicense: () => ipcRenderer.invoke('load-saved-license'),
  saveLicenseFile: (licenseKey) => ipcRenderer.invoke('save-license-file', licenseKey),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  applyOtaUpdate: (distUrl, version) => ipcRenderer.invoke('apply-ota-update', distUrl, version),
  downloadAndInstallUpdate: (downloadUrl) => ipcRenderer.invoke('download-and-install-update', downloadUrl),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  onDownloadProgress: (callback) => {
    const listener = (_event, percent) => callback(percent);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  onOtaUpdateDownloading: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('ota-update-downloading', listener);
    return () => ipcRenderer.removeListener('ota-update-downloading', listener);
  },
  onOtaUpdateReady: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('ota-update-ready', listener);
    return () => ipcRenderer.removeListener('ota-update-ready', listener);
  },
});
