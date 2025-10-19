import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para obter o __dirname no ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// 1. Servir os arquivos estáticos da pasta 'dist'
// A pasta 'dist' contém a versão de produção do seu aplicativo React.
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Rota "catch-all" para Single Page Applications (SPA)
// Isso garante que, se o usuário recarregar a página em uma rota como /books,
// o servidor ainda envie o index.html. O React Router cuidará do resto no lado do cliente.
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor de produção rodando em http://localhost:${port}`);
});