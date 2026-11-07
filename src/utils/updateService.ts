import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface UpdateInfo {
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
}

export const LOCAL_VERSION = '1.0.3';

/**
 * Retorna a versão real instalada (via Electron ou constante local)
 */
export async function getInstalledVersion(): Promise<string> {
  if (typeof window !== 'undefined' && window.electron && typeof window.electron.getAppVersion === 'function') {
    try {
      const v = await window.electron.getAppVersion();
      if (v) return v;
    } catch (e) {
      console.warn('Erro ao ler versão do Electron:', e);
    }
  }
  return LOCAL_VERSION;
}

/**
 * Compara versões no padrão semver
 */
export function isNewerVersion(remote: string, local: string): boolean {
  const cleanRemote = (remote || '').replace(/^v/i, '').trim();
  const cleanLocal = (local || '').replace(/^v/i, '').trim();

  const rParts = cleanRemote.split('.').map(n => parseInt(n, 10) || 0);
  const lParts = cleanLocal.split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < len; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

/**
 * Consulta atualizações tanto no Electron quanto via Firestore/GitHub
 */
export async function checkSystemUpdates(): Promise<UpdateInfo> {
  let currentVer = LOCAL_VERSION;

  // 1. Se estiver no Electron, tenta o canal nativo do Electron primeiro
  if (typeof window !== 'undefined' && window.electron) {
    try {
      if (typeof window.electron.getAppVersion === 'function') {
        const v = await window.electron.getAppVersion();
        if (v) currentVer = v;
      }

      if (typeof window.electron.checkForUpdates === 'function') {
        const electronResult = await window.electron.checkForUpdates();
        if (electronResult && electronResult.latestVersion) {
          if (electronResult.updateAvailable) {
            return {
              ...electronResult,
              currentVersion: currentVer,
            };
          }
        }
      }
    } catch (e) {
      console.warn('[UpdateService] Falha na checagem nativa do Electron:', e);
    }
  }

  // 2. Consulta Firestore (canal imediato administrado em tempo real)
  try {
    const docRef = doc(db, 'settings', 'app_updates');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const remoteVer = (data.latestVersion || '').trim();
      if (remoteVer && isNewerVersion(remoteVer, currentVer)) {
        return {
          updateAvailable: true,
          currentVersion: currentVer,
          latestVersion: remoteVer,
          releaseNotes: data.releaseNotes || 'Nova versão disponível com melhorias e correções.',
          downloadUrl: data.downloadUrl || 'https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases',
          distUrl: data.distUrl || `https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases/download/v${remoteVer}/dist.zip`,
          publishedAt: data.publishedAt || new Date().toISOString(),
        };
      }
    }
  } catch (e) {
    // Silently continue
  }

  // 3. Fallback: Consulta direta ao GitHub Releases API
  try {
    const res = await fetch('https://api.github.com/repos/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (res.ok) {
      const release = await res.json();
      const remoteVer = (release.tag_name || '').replace(/^v/i, '').trim();
      if (remoteVer && isNewerVersion(remoteVer, currentVer)) {
        let downloadUrl = release.html_url;
        let distUrl = `https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases/download/v${remoteVer}/dist.zip`;

        if (Array.isArray(release.assets)) {
          const exe = release.assets.find((a: any) => a.name?.toLowerCase().endsWith('.exe'));
          if (exe?.browser_download_url) {
            downloadUrl = exe.browser_download_url;
          }
          const distAsset = release.assets.find((a: any) => a.name === 'dist.zip' || a.name?.toLowerCase().endsWith('-dist.zip'));
          if (distAsset?.browser_download_url) {
            distUrl = distAsset.browser_download_url;
          }
        }

        return {
          updateAvailable: true,
          currentVersion: currentVer,
          latestVersion: remoteVer,
          releaseNotes: release.body || 'Correções e atualizações do sistema.',
          downloadUrl,
          distUrl,
          publishedAt: release.published_at,
          releaseUrl: release.html_url,
        };
      }
    }
  } catch (e) {}

  return {
    updateAvailable: false,
    currentVersion: currentVer,
    latestVersion: currentVer,
    message: 'Seu sistema está operando na versão mais recente disponível.',
  };
}

/**
 * Aplica atualização leve OTA (Over-The-Air)
 */
export async function applyOtaUpdateService(distUrl: string, version: string) {
  if (typeof window !== 'undefined' && window.electron && typeof window.electron.applyOtaUpdate === 'function') {
    return await window.electron.applyOtaUpdate(distUrl, version);
  }
  throw new Error('Atualização OTA suportada apenas no aplicativo desktop Electron.');
}

/**
 * Reinicia o sistema ou recarrega a janela para aplicar a nova versão
 */
export async function restartAppService() {
  if (typeof window !== 'undefined' && window.electron && typeof window.electron.restartApp === 'function') {
    await window.electron.restartApp();
    return true;
  }
  if (typeof window !== 'undefined') {
    window.location.reload();
    return true;
  }
  return false;
}

/**
 * Escuta em tempo real atualizações publicadas na nuvem para atualizar instantaneamente todos os PCs
 */
export function subscribeToRemoteUpdates(onUpdateDetected: (info: UpdateInfo) => void): () => void {
  const docRef = doc(db, 'settings', 'app_updates');
  return onSnapshot(docRef, async (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const remoteVer = (data.latestVersion || '').trim();
    const currentVer = await getInstalledVersion();

    if (remoteVer && isNewerVersion(remoteVer, currentVer)) {
      onUpdateDetected({
        updateAvailable: true,
        currentVersion: currentVer,
        latestVersion: remoteVer,
        releaseNotes: data.releaseNotes || 'Nova versão disponível com melhorias e correções.',
        downloadUrl: data.downloadUrl || 'https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases',
        distUrl: data.distUrl || `https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases/download/v${remoteVer}/dist.zip`,
        publishedAt: data.publishedAt || new Date().toISOString(),
      });
    }
  }, (err) => {
    console.warn('[UpdateService] Listener de atualizações:', err.message);
  });
}

/**
 * Publica uma nova versão no Firestore (área do desenvolvedor)
 */
export async function publishNewVersion(params: {
  version: string;
  notes: string;
  downloadUrl?: string;
  distUrl?: string;
}): Promise<void> {
  const cleanVer = params.version.trim().replace(/^v/i, '');
  const docRef = doc(db, 'settings', 'app_updates');
  await setDoc(docRef, {
    schoolName: 'Escola Maria Rita',
    latestVersion: cleanVer,
    releaseNotes: params.notes.trim(),
    downloadUrl: params.downloadUrl?.trim() || `https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases/download/v${cleanVer}/Sistema-de-Biblioteca-Maria-Rita-Setup-${cleanVer}.exe`,
    distUrl: params.distUrl?.trim() || `https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases/download/v${cleanVer}/dist.zip`,
    publishedAt: new Date().toISOString(),
  }, { merge: true });
}
