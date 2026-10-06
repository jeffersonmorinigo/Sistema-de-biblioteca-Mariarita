/// <reference types="vite/client" />

interface Window {
  electron?: {
    quitApp: () => void;
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
      publishedAt?: string;
      releaseUrl?: string;
      message?: string;
      error?: string;
    }>;
    downloadAndInstallUpdate: (downloadUrl: string) => Promise<{
      success?: boolean;
      executingInstaller?: boolean;
      openedInBrowser?: boolean;
    }>;
    getAppVersion: () => Promise<string>;
    openExternalUrl: (url: string) => Promise<boolean>;
    onDownloadProgress: (callback: (percent: number) => void) => () => void;
  };
}