const https = require('https');
const fs = require('fs');
const path = require('path');

const token = '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';
const owner = 'jeffersonmorinigo';
const repo = 'Sistema-de-biblioteca-Mariarita';
const tag = 'v1.0.3';
const releaseName = 'Versão 1.0.3 - Atualização Automática em Rede (OTA)';
const releaseBody = `## Novidades da Versão 1.0.3
- 🚀 **Atualização Automática sem Reinstalar (OTA)**: Todos os computadores da biblioteca conectados à rede recebem e aplicam atualizações instantaneamente em segundo plano sem que você precise baixar ou instalar executáveis novamente.
- ⚡ **Pacote Ultraleve (dist.zip)**: Apenas os arquivos do sistema (~3 MB) são atualizados em 2 segundos em vez do download de 120 MB.
- 🔄 **Notificação e Reinício Inteligente**: Banner avisando quando o sistema está atualizado, com reinício limpo em 1 clique.
- 🛡️ **Instalador Silencioso (/S)**: Para novas máquinas, o instalador agora instala silenciosamente sem passos manuais.`;

function apiRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function uploadAsset(releaseId, filePath, assetName, contentType = 'application/octet-stream') {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Arquivo não encontrado para upload: ${filePath}`));
    }
    const stat = fs.statSync(filePath);
    console.log(`Iniciando upload de ${assetName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);
    const readStream = fs.createReadStream(filePath);

    const req = https.request({
      hostname: 'uploads.github.com',
      path: `/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`,
      method: 'POST',
      headers: {
        'User-Agent': 'Node-Uploader',
        'Authorization': `token ${token}`,
        'Content-Type': contentType,
        'Content-Length': stat.size,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Upload de ${assetName} finalizado: status ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Falha no upload HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    let uploadedBytes = 0;
    let lastLog = Date.now();
    readStream.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      if (Date.now() - lastLog > 5000) {
        const percent = ((uploadedBytes / stat.size) * 100).toFixed(1);
        console.log(`Progresso de ${assetName}: ${percent}% (${(uploadedBytes / 1024 / 1024).toFixed(1)} MB)`);
        lastLog = Date.now();
      }
    });

    readStream.pipe(req);
  });
}

async function getOrCreateRelease() {
  console.log(`Buscando release com tag ${tag}...`);
  const getRes = await apiRequest({
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases/tags/${tag}`,
    method: 'GET',
    headers: { 'User-Agent': 'Node', 'Authorization': `token ${token}` },
  });

  if (getRes.statusCode === 200) {
    const rel = JSON.parse(getRes.data);
    console.log(`Release ${tag} encontrada (id: ${rel.id})`);
    return rel;
  }

  console.log(`Release ${tag} não existe. Criando nova release...`);
  const postData = JSON.stringify({
    tag_name: tag,
    target_commitish: 'main',
    name: releaseName,
    body: releaseBody,
    draft: false,
    prerelease: false,
  });

  const createRes = await apiRequest({
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases`,
    method: 'POST',
    headers: {
      'User-Agent': 'Node',
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);

  if (createRes.statusCode >= 200 && createRes.statusCode < 300) {
    const newRel = JSON.parse(createRes.data);
    console.log(`Release criada com sucesso! ID: ${newRel.id}`);
    return newRel;
  } else {
    throw new Error(`Falha ao criar release: ${createRes.statusCode} - ${createRes.data}`);
  }
}

async function main() {
  try {
    const release = await getOrCreateRelease();
    const releaseId = release.id;

    console.log('Listando assets existentes da release...');
    const listRes = await apiRequest({
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/releases/${releaseId}/assets`,
      method: 'GET',
      headers: { 'User-Agent': 'Node', 'Authorization': `token ${token}` },
    });
    const assets = JSON.parse(listRes.data);
    console.log('Assets atuais:', assets.map(a => a.name));

    const toUpload = [
      { name: 'dist.zip', path: 'f:\\Sistema de biblioteca Maria Rita\\release\\dist.zip', type: 'application/zip' },
      { name: 'latest.yml', path: 'f:\\Sistema de biblioteca Maria Rita\\release\\latest.yml', type: 'text/yaml' },
      { name: 'Sistema-de-Biblioteca-Maria-Rita-Setup-1.0.3.exe', path: 'f:\\Sistema de biblioteca Maria Rita\\release\\Sistema de Biblioteca Maria Rita Setup 1.0.3.exe', type: 'application/octet-stream' },
    ];

    for (const item of toUpload) {
      const existing = assets.find(a => a.name === item.name);
      if (existing) {
        console.log(`Deletando asset antigo ${item.name} (id: ${existing.id})...`);
        await apiRequest({
          hostname: 'api.github.com',
          path: `/repos/${owner}/${repo}/releases/assets/${existing.id}`,
          method: 'DELETE',
          headers: { 'User-Agent': 'Node', 'Authorization': `token ${token}` },
        });
      }
    }

    for (const item of toUpload) {
      if (fs.existsSync(item.path)) {
        await uploadAsset(releaseId, item.path, item.name, item.type);
      } else {
        console.warn(`Aviso: Arquivo ${item.path} não encontrado, pulando upload.`);
      }
    }

    console.log('Release v1.0.3 atualizada com sucesso no GitHub!');
  } catch (err) {
    console.error('Erro na publicação:', err);
    process.exit(1);
  }
}

main();
