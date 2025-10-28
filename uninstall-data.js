const fs = require('fs');
const path = require('path');
const os = require('os');

const APP_NAME = 'Sistema de Biblioteca'; // Deve corresponder ao productName em package.json

function getAppDataPath() {
    switch (process.platform) {
        case 'darwin': // macOS
            return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
        case 'win32': // Windows
            return path.join(os.homedir(), 'AppData', 'Roaming', APP_NAME);
        case 'linux': // Linux
            return path.join(os.homedir(), '.config', APP_NAME);
        default:
            console.error(`Plataforma não suportada: ${process.platform}`);
            return null;
    }
}

function uninstallData() {
    const appDataPath = getAppDataPath();

    if (!appDataPath) {
        console.log('Não foi possível determinar o caminho dos dados da aplicação.');
        return;
    }

    if (fs.existsSync(appDataPath)) {
        console.log(`Removendo diretório de dados: ${appDataPath}`);
        try {
            fs.rmSync(appDataPath, { recursive: true, force: true });
            console.log('Dados da aplicação removidos com sucesso.');
        } catch (err) {
            console.error(`Erro ao remover dados: ${err.message}`);
            console.log('Pode ser necessário executar este script como administrador.');
        }
    } else {
        console.log('Diretório de dados da aplicação não encontrado. Nada a remover.');
    }
}

uninstallData();