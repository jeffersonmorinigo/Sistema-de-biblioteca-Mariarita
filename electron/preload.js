const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  quitApp: () => ipcRenderer.send('quit-app'),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  loadSavedLicense: () => ipcRenderer.invoke('load-saved-license'),
  saveLicenseFile: (licenseKey) => ipcRenderer.invoke('save-license-file', licenseKey),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadAndInstallUpdate: (downloadUrl) => ipcRenderer.invoke('download-and-install-update', downloadUrl),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  onDownloadProgress: (callback) => {
    const listener = (_event, percent) => callback(percent);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
});