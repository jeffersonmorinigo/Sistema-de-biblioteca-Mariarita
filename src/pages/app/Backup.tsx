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
import { generateAndDownloadJsonBackup, generateAndDownloadSqlBackup } from '@/lib/backupUtils';

const LOCAL_STORAGE_KEYS = [
  'books', 'students', 'loans', 'users', 
  'schoolName', 'book_categories', 'student_classes', 'book_shelves',
  'isAuthenticated'
];

const BackupPage = () => {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const handleJsonBackup = () => {
    if (generateAndDownloadJsonBackup('backup_manual')) {
      showSuccess('Backup JSON gerado e baixado com sucesso!');
    } else {
      showError('Ocorreu um erro ao gerar o backup JSON.');
    }
  };

  const handleSqlBackup = () => {
    if (generateAndDownloadSqlBackup('backup_manual')) {
      showSuccess('Backup SQL gerado e baixado com sucesso!');
    } else {
      showError('Ocorreu um erro ao gerar o backup SQL.');
    }
  };

  const handleRestore = () => {
    if (!restoreFile) {
      showError('Por favor, selecione um arquivo de backup.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        const hasRequiredKeys = LOCAL_STORAGE_KEYS.some(key => backupData.hasOwnProperty(key));
        if (!hasRequiredKeys) {
          showError('Arquivo de backup inválido ou corrompido.');
          return;
        }
        Object.keys(backupData).forEach(key => {
          if (LOCAL_STORAGE_KEYS.includes(key)) {
            localStorage.setItem(key, JSON.stringify(backupData[key]));
          }
        });
        showSuccess('Backup restaurado com sucesso! A página será recarregada.');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        showError('Ocorreu um erro ao restaurar o backup. Verifique o arquivo.');
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
              <Button onClick={handleJsonBackup}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Backup (JSON)
              </Button>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Backup de Portabilidade (SQL)</h4>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Use este arquivo para migrar os dados para outro sistema de banco de dados. <strong>Não pode ser restaurado aqui.</strong>
              </p>
              <Button onClick={handleSqlBackup} variant="secondary">
                <Database className="mr-2 h-4 w-4" />
                Baixar Backup (SQL)
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
                A restauração de um backup irá **substituir todos os dados atuais** da aplicação. Essa ação não pode ser desfeita.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <label htmlFor="restore-file" className="text-sm font-medium">Arquivo de Backup (.json)</label>
              <Input id="restore-file" type="file" accept=".json" onChange={(e) => setRestoreFile(e.target.files ? e.target.files[0] : null)} />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!restoreFile}>
                  <Upload className="mr-2 h-4 w-4" />
                  Restaurar Dados
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível e substituirá todos os dados existentes pelos dados do arquivo de backup selecionado.
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