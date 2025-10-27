const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  // Cria a janela do navegador.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Sistema de Biblioteca', // Define o título da janela
    autoHideMenuBar: true, // Oculta a barra de menu
    webPreferences: {
      // Desabilita a integração de node no renderizador por segurança,
      // a menos que você realmente precise dela e saiba os riscos.
      nodeIntegration: false,
      contextIsolation: true,
      // Você pode adicionar um preload script aqui se precisar de comunicação IPC segura
      // preload: path.join(__dirname, 'preload.js'), 
    },
  });

  // Carrega a aplicação React.
  // Em desenvolvimento, carrega do servidor Vite.
  // Em produção, carrega o arquivo index.html do build.
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080'); // Porta padrão do Vite
    // Abre as ferramentas de desenvolvedor.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// Este método será chamado quando o Electron terminar a inicialização
// e estiver pronto para criar janelas do navegador.
app.whenReady().then(() => {
  createWindow();

  // No macOS, é comum recriar uma janela no aplicativo quando o ícone do dock é clicado e não há outras janelas abertas.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Sai quando todas as janelas são fechadas, exceto no macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});