const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

function getLocalIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  // Prioriza Wi-Fi e Ethernet
  ips.sort((a, b) => {
    const aIsWifi = /wi-?fi|wlan|ethernet|sem fio/i.test(a.name);
    const bIsWifi = /wi-?fi|wlan|ethernet|sem fio/i.test(b.name);
    if (aIsWifi && !bIsWifi) return -1;
    if (!aIsWifi && bIsWifi) return 1;
    return 0;
  });
  return ips;
}

function createRequestHandler(distDir) {
  return function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let pathname;
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(parsedUrl.pathname);
    } catch (e) {
      pathname = '/index.html';
    }

    if (pathname === '/' || !pathname) {
      pathname = '/index.html';
    }

    let filePath = path.join(distDir, pathname);

    // Evita navegação para fora de dist
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Acesso negado');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback SPA: serve dist/index.html
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(500);
          res.end('Erro ao carregar arquivo');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });
  };
}

function startEmbeddedServer(distDir, options = {}) {
  const httpsPort = options.httpsPort || 8080;
  const httpPort = options.httpPort || 8081;
  const handler = createRequestHandler(distDir);

  let sslCert = null;
  const certPath = path.join(__dirname, 'ssl', 'cert.pem');
  if (fs.existsSync(certPath)) {
    try {
      sslCert = fs.readFileSync(certPath);
    } catch (e) {
      console.error('[EmbeddedServer] Erro ao carregar certificado SSL:', e);
    }
  }

  let httpsServer = null;
  if (sslCert) {
    try {
      httpsServer = https.createServer({ key: sslCert, cert: sslCert }, handler);
      httpsServer.listen(httpsPort, '0.0.0.0', () => {
        console.log(`[EmbeddedServer] Servidor HTTPS ativo em https://0.0.0.0:${httpsPort}`);
      });
      httpsServer.on('error', (err) => {
        console.error('[EmbeddedServer] Erro no servidor HTTPS:', err);
      });
    } catch (e) {
      console.error('[EmbeddedServer] Falha ao iniciar HTTPS:', e);
    }
  }

  let httpServer = null;
  try {
    httpServer = http.createServer(handler);
    httpServer.listen(httpPort, '0.0.0.0', () => {
      console.log(`[EmbeddedServer] Servidor HTTP ativo em http://0.0.0.0:${httpPort}`);
    });
    httpServer.on('error', (err) => {
      console.error('[EmbeddedServer] Erro no servidor HTTP:', err);
    });
  } catch (e) {
    console.error('[EmbeddedServer] Falha ao iniciar HTTP:', e);
  }

  return {
    httpsPort,
    httpPort,
    getLocalIps,
    close: () => {
      if (httpsServer) httpsServer.close();
      if (httpServer) httpServer.close();
    }
  };
}

module.exports = {
  startEmbeddedServer,
  getLocalIps
};
