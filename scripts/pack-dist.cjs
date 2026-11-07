const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(rootDir, 'release');
const zipOut = path.join(releaseDir, 'dist.zip');
const rootZip = path.join(rootDir, 'dist.zip');

if (!fs.existsSync(distDir)) {
  console.error('Diretório dist não encontrado. Execute npm run build primeiro.');
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });

console.log('Compactando pacote de atualização OTA (dist.zip)...');
try {
  execSync(`tar -a -cf "${zipOut}" -C "${distDir}" .`);
  fs.copyFileSync(zipOut, rootZip);
  const stat = fs.statSync(zipOut);
  console.log(`Pacote dist.zip gerado com sucesso: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
} catch (err) {
  console.error('Erro ao gerar dist.zip:', err);
  process.exit(1);
}
