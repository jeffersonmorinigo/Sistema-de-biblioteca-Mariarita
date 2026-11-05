import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  downloadUrl?: string;
  publishedAt?: string;
  releaseUrl?: string;
  message?: string;
  error?: string;
}

const LOCAL_VERSION = '1.0.2';

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
          // Se encontrou via GitHub Releases
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

  // 2. Consulta Firestore (canal imediato administrado pelo desenvolvedor)
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
        if (Array.isArray(release.assets)) {
          const exe = release.assets.find((a: any) => a.name?.toLowerCase().endsWith('.exe'));
          if (exe?.browser_download_url) {
            downloadUrl = exe.browser_download_url;
          }
        }
        return {
          updateAvailable: true,
          currentVersion: currentVer,
          latestVersion: remoteVer,
          releaseNotes: release.body || 'Correções e atualizações do sistema.',
          downloadUrl,
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
 * Publica uma nova versão no Firestore (área do desenvolvedor)
 */
export async function publishNewVersion(params: {
  version: string;
  notes: string;
  downloadUrl?: string;
}): Promise<void> {
  const docRef = doc(db, 'settings', 'app_updates');
  await setDoc(docRef, {
    schoolName: 'Escola Maria Rita',
    latestVersion: params.version.trim().replace(/^v/i, ''),
    releaseNotes: params.notes.trim(),
    downloadUrl: params.downloadUrl?.trim() || '',
    publishedAt: new Date().toISOString(),
  }, { merge: true });
}
