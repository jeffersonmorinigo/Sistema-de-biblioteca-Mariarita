const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { shell, app } = require('electron');

const GITHUB_REPO = 'jeffersonmorinigo/Sistema-de-biblioteca-Mariarita';
const RAW_VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json`;
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Faz requisição HTTPS segura com suporte a redirecionamento e User-Agent
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'Sistema-Biblioteca-Maria-Rita-Updater',
          'Accept': 'application/vnd.github.v3+json',
        },
      },
      (res) => {
        // Suporte a redirects (301, 302, 307)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchJson(res.headers.location).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }

        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Resposta JSON inválida do servidor de atualizações.'));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Tempo esgotado ao conectar ao servidor de atualizações.'));
    });
  });
}

/**
 * Compara duas versões no formato semver (ex: "1.0.1" vs "1.0.0")
 * Retorna true se remote > local
 */
function isNewerVersion(remote, local) {
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
 * Verifica se há novas versões disponíveis no GitHub
 */
async function checkUpdates(currentVersion) {
  const version = currentVersion || app.getVersion() || '1.0.0';

  // 1. Tenta via GitHub Releases API oficial
  try {
    const release = await fetchJson(RELEASES_API_URL);
    if (release && release.tag_name) {
      const latestVer = release.tag_name.replace(/^v/i, '').trim();
      const hasUpdate = isNewerVersion(latestVer, version);

      let downloadUrl = release.html_url;
      // Procura por executável de instalação nos assets (.exe)
      if (Array.isArray(release.assets)) {
        const exeAsset = release.assets.find(
          a => a.name && a.name.toLowerCase().endsWith('.exe')
        );
        if (exeAsset && exeAsset.browser_download_url) {
          downloadUrl = exeAsset.browser_download_url;
        }
      }

      return {
        updateAvailable: hasUpdate,
        currentVersion: version,
        latestVersion: latestVer,
        releaseNotes: release.body || 'Atualização de estabilidade e novas funcionalidades.',
        downloadUrl,
        publishedAt: release.published_at || new Date().toISOString(),
        releaseUrl: release.html_url,
      };
    }
  } catch (err) {
    // Release API pode retornar 404 se ainda não houver release pública criada
  }

  // 2. Fallback: Tenta via version.json raw no repositório
  try {
    const rawData = await fetchJson(RAW_VERSION_URL);
    if (rawData && rawData.version) {
      const latestVer = rawData.version.replace(/^v/i, '').trim();
      const hasUpdate = isNewerVersion(latestVer, version);

      return {
        updateAvailable: hasUpdate,
        currentVersion: version,
        latestVersion: latestVer,
        releaseNotes: rawData.notes || rawData.releaseNotes || 'Correções e melhorias gerais.',
        downloadUrl: rawData.downloadUrl || `https://github.com/${GITHUB_REPO}/releases`,
        publishedAt: rawData.publishedAt || new Date().toISOString(),
      };
    }
  } catch (e) {
    // Silently continue
  }

  return {
    updateAvailable: false,
    currentVersion: version,
    latestVersion: version,
    message: 'Seu sistema já está na versão mais recente.',
  };
}

/**
 * Baixa e executa o instalador da nova versão
 */
function downloadAndInstall(downloadUrl, onProgress) {
  return new Promise((resolve, reject) => {
    if (!downloadUrl) {
      return reject(new Error('URL de download não informada.'));
    }

    // Se não for link direto para executável, abre o navegador para o usuário baixar
    if (!downloadUrl.toLowerCase().endsWith('.exe')) {
      shell.openExternal(downloadUrl);
      return resolve({ openedInBrowser: true });
    }

    const tempFilePath = path.join(os.tmpdir(), `SistemaBiblioteca_Update_${Date.now()}.exe`);
    const fileStream = fs.createWriteStream(tempFilePath);

    function startDownload(url) {
      const client = url.startsWith('https') ? https : http;
      client.get(url, { headers: { 'User-Agent': 'Sistema-Biblioteca-Updater' } }, (res) => {
        // Redirecionamentos (Amazon S3 / GitHub Assets sempre redirecionam)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return startDownload(res.headers.location);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Erro no download: HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0 && typeof onProgress === 'function') {
            const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
            onProgress(percent);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            try {
              // Executa o novo instalador e fecha o app atual
              const child = spawn(tempFilePath, [], {
                detached: true,
                stdio: 'ignore',
              });
              child.unref();

              // Fecha a aplicação para permitir a substituição dos arquivos
              setTimeout(() => {
                app.quit();
              }, 1000);

              resolve({ success: true, executingInstaller: true });
            } catch (spawnErr) {
              reject(spawnErr);
            }
          });
        });
      }).on('error', (err) => {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
        reject(err);
      });
    }

    startDownload(downloadUrl);
  });
}

module.exports = {
  checkUpdates,
  downloadAndInstall,
  isNewerVersion,
};
