const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SALT = 'MARIARITA_HARDWARE_FINGERPRINT_2026_@PROT';

function getWindowsMachineGuid() {
  try {
    const stdout = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = stdout.match(/MachineGuid\s+REG_SZ\s+([a-f0-9\-]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (err) {
    // Silently fall back
  }
  return null;
}

function getMacAddress() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
  } catch (e) {}
  return '';
}

function getHardwareId() {
  const guid = getWindowsMachineGuid();
  const mac = getMacAddress();
  const rawHost = os.hostname() || 'PC';
  const prefix = rawHost.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'PC';

  const rawSeed = `${guid || ''}|${mac}|${rawHost}|${SALT}`;
  const hash = crypto.createHash('sha256').update(rawSeed).digest('hex').toUpperCase();

  return `${prefix}-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
}

function getLicenseFilePath(app) {
  try {
    const userData = app.getPath('userData');
    return path.join(userData, 'system_license.lic');
  } catch (e) {
    return null;
  }
}

function loadSavedLicense(app) {
  try {
    const filePath = getLicenseFilePath(app);
    if (filePath && fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
  } catch (e) {
    console.error('[MachineId] Erro ao ler arquivo de licença:', e);
  }
  return null;
}

function saveLicenseFile(app, licenseKey) {
  try {
    const filePath = getLicenseFilePath(app);
    if (filePath) {
      fs.writeFileSync(filePath, (licenseKey || '').trim(), 'utf8');
      return true;
    }
  } catch (e) {
    console.error('[MachineId] Erro ao gravar arquivo de licença:', e);
  }
  return false;
}

module.exports = {
  getHardwareId,
  loadSavedLicense,
  saveLicenseFile,
};
