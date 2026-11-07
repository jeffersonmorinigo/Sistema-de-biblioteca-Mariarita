/// <reference types="vite/client" />

interface Window {
  electron?: {
    quitApp: () => void;
    restartApp: () => Promise<boolean>;
    reloadActiveDist: () => Promise<boolean>;
    getNetworkInfo: () => Promise<{
      ips: Array<{ name: string; address: string; family: string }>;
      primaryIp: string;
      httpsPort: number;
      httpPort: number;
    }>;
    getMachineId: () => Promise<string>;
    loadSavedLicense: () => Promise<string | null>;
    saveLicenseFile: (key: string) => Promise<boolean>;
    checkForUpdates: () => Promise<{
      updateAvailable: boolean;
      currentVersion: string;
      latestVersion: string;
      releaseNotes?: string;
      downloadUrl?: string;
      distUrl?: string;
      publishedAt?: string;
      releaseUrl?: string;
      message?: string;
      error?: string;
    }>;
    applyOtaUpdate: (distUrl: string, version: string) => Promise<{
      success?: boolean;
      version?: string;
      distDir?: string;
    }>;
    downloadAndInstallUpdate: (downloadUrl: string) => Promise<{
      success?: boolean;
      executingInstaller?: boolean;
      openedInBrowser?: boolean;
    }>;
    getAppVersion: () => Promise<string>;
    openExternalUrl: (url: string) => Promise<boolean>;
    onDownloadProgress: (callback: (percent: number) => void) => () => void;
    onOtaUpdateDownloading: (callback: (data: { version: string; notes?: string }) => void) => () => void;
    onOtaUpdateReady: (callback: (data: { version: string; notes?: string }) => void) => () => void;
  };
}
