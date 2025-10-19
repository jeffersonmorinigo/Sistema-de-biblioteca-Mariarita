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
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';

const BackupPage = () => {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const LOCAL_STORAGE_KEYS = [
    'books', 'students', 'loans', 'users', 
    'schoolName', 'book_categories', 'student_classes',
    'isAuthenticated' // Manter o estado de login
  ];

  const handleBackup = () => {
    try {
      const backupData: { [key: string]: any } = {};
      LOCAL_STORAGE_KEYS.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          backupData[key] = JSON.parse(item);
        }
      });

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      link.href = url;
      link.download = `backup_biblioteca_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('Backup gerado e baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar backup:', error);
      showError('Ocorreu um erro ao gerar o backup.');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setRestoreFile(event.target.files[0]);
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
        
        // Validação simples para garantir que é um arquivo de backup válido
        const hasRequiredKeys = LOCAL_STORAGE_KEYS.some(key => backupData.hasOwnProperty(key));
        if (!hasRequiredKeys) {
          showError('Arquivo de backup inválido ou corrompido.');
          return;
        }

        // Limpa o localStorage atual antes de restaurar
        // localStorage.clear(); // Opcional: pode ser mais seguro apenas sobrescrever

        Object.keys(backupData).forEach(key => {
          if (LOCAL_STORAGE_KEYS.includes(key)) {
            localStorage.setItem(key, JSON.stringify(backupData[key]));
          }
        });

        showSuccess('Backup restaurado com sucesso! A página será recarregada.');
        
        // Recarrega a página para que todas as informações sejam atualizadas
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
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fazer Backup</CardTitle>
            <CardDescription>
              Crie um backup completo de todos os dados da aplicação. O arquivo será salvo na sua pasta de downloads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Recomendamos fazer backups diários e salvar o arquivo em um local seguro na nuvem (Google Drive, Dropbox, etc.).
            </p>
            <Button onClick={handleBackup}>
              <Download className="mr-2 h-4 w-4" />
              Baixar Arquivo de Backup
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restaurar Backup</CardTitle>
            <CardDescription>
              Restaure os dados da aplicação a partir de um arquivo de backup.
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
              <Input id="restore-file" type="file" accept=".json" onChange={handleFileChange} />
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
                    Esta ação é irreversível e substituirá todos os dados existentes (livros, alunos, empréstimos, etc.) pelos dados do arquivo de backup selecionado.
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