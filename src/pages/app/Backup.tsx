import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Download, Upload, AlertTriangle, Database } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { generateAndDownloadJsonBackup, generateAndDownloadSqlBackup, restoreFromBackup } from '@/lib/backupUtils';

const BackupPage = () => {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleJsonBackup = async () => {
    setIsProcessing(true);
    const success = await generateAndDownloadJsonBackup('backup_manual');
    if (success) {
      showSuccess('Backup JSON gerado e baixado com sucesso!');
    } else {
      showError('Ocorreu um erro ao gerar o backup JSON.');
    }
    setIsProcessing(false);
  };

  const handleSqlBackup = async () => {
    setIsProcessing(true);
    const success = await generateAndDownloadSqlBackup('backup_manual');
    if (success) {
      showSuccess('Backup SQL gerado e baixado com sucesso!');
    } else {
      showError('Ocorreu um erro ao gerar o backup SQL.');
    }
    setIsProcessing(false);
  };

  const handleRestore = () => {
    if (!restoreFile) {
      showError('Por favor, selecione um arquivo de backup.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (!content || !content.trim().startsWith('{')) {
          throw new Error('O arquivo selecionado não parece ser um backup JSON válido.');
        }

        const backupData = JSON.parse(content);

        // Validação básica: deve ter pelo menos alguma chave conhecida (nova ou antiga)
        const knownKeys = [
          'books', 'students', 'loans', 'users', 'schoolName',
          'livros', 'alunos', 'emprestimos', 'usuarios', 'categoriasLivros'
        ];
        const hasData = knownKeys.some(key => backupData.hasOwnProperty(key));

        if (!hasData) {
          showError('Arquivo de backup não reconhecido. Certifique-se de que é um backup do sistema de biblioteca.');
          setIsProcessing(false);
          return;
        }

        console.log('[UI] Iniciando restauração do arquivo:', restoreFile.name);
        await restoreFromBackup(backupData);

        showSuccess('Carga de dados concluída com sucesso! Sincronizando com a nuvem...');

        // Pequeno delay para garantir que o Firestore processou tudo antes do reload
        setTimeout(() => {
          showSuccess('Sistema pronto! Recarregando...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }, 1500);
      } catch (error: any) {
        console.error('Erro ao restaurar backup:', error);
        showError(`Falha na restauração: ${error.message || 'Verifique o formato do arquivo'}`);
        setIsProcessing(false);
      }
    };
    reader.readAsText(restoreFile);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Backup & Restauração</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Fazer Backup</CardTitle>
            <CardDescription>
              Crie uma cópia de segurança de todos os dados da aplicação. Salve os arquivos em um local seguro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Backup Principal (JSON)</h4>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Use este arquivo para restaurar os dados neste sistema.
              </p>
              <Button onClick={handleJsonBackup} disabled={isProcessing}>
                <Download className="mr-2 h-4 w-4" />
                {isProcessing ? 'Gerando...' : 'Baixar Backup (JSON)'}
              </Button>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Backup de Portabilidade (SQL)</h4>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Use este arquivo para migrar os dados para outro sistema de banco de dados. <strong>Não pode ser restaurado aqui.</strong>
              </p>
              <Button onClick={handleSqlBackup} variant="secondary" disabled={isProcessing}>
                <Database className="mr-2 h-4 w-4" />
                {isProcessing ? 'Gerando...' : 'Baixar Backup (SQL)'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restaurar Backup (JSON)</CardTitle>
            <CardDescription>
              Restaure os dados da aplicação a partir de um arquivo de backup <strong>.json</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção!</AlertTitle>
              <AlertDescription>
                A restauração de um backup irá **substituir todos os dados atuais** da aplicação no Firestore. Essa ação não pode ser desfeita.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <label htmlFor="restore-file" className="text-sm font-medium">Arquivo de Backup (.json)</label>
              <Input
                id="restore-file"
                type="file"
                accept=".json"
                onChange={(e) => setRestoreFile(e.target.files ? e.target.files[0] : null)}
                disabled={isProcessing}
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!restoreFile || isProcessing}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isProcessing ? 'Restaurando...' : 'Restaurar Dados'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível e substituirá todos os dados existentes no Banco de Dados (Firestore) pelos dados do arquivo de backup selecionado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestore}>
                    Sim, restaurar backup
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BackupPage;