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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Upload, AlertTriangle, Database, Trash2, CloudUpload, CloudDownload, RefreshCw, CheckCircle2 } from 'lucide-react';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { generateAndDownloadJsonBackup, generateAndDownloadSqlBackup, restoreFromBackup } from '@/lib/backupUtils';
import { getAll, deleteDocument } from '@/lib/firestoreService';
import { getLocalCollection, saveLocalCollection, enqueueSyncOperation } from '@/lib/localDb';
import { processSyncQueue, uploadAllLocalDataToCloud, downloadAllFromCloud } from '@/lib/syncService';
import { Loan } from '@/lib/types';


const BackupPage = () => {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cleanupMonth, setCleanupMonth] = useState<string>("all");
  const [cleanupYear, setCleanupYear] = useState<string>(new Date().getFullYear().toString());

  const months = [
    { value: "all", label: "Todos os Meses" },
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

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

  const handleUploadAllToCloud = async () => {
    setIsProcessing(true);
    showInfo('Enviando todos os dados deste computador para a nuvem...');
    try {
      const res = await uploadAllLocalDataToCloud();
      showSuccess(`Sincronização concluída com sucesso! ${res.booksUploaded} livros, ${res.studentsUploaded} alunos e ${res.loansUploaded} empréstimos enviados. Os outros computadores já têm acesso a tudo!`);
    } catch (err: any) {
      showError(`Erro ao enviar dados para a nuvem: ${err.message || 'Verifique a conexão'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAllFromCloud = async () => {
    setIsProcessing(true);
    showInfo('Baixando todos os dados da nuvem para este computador...');
    try {
      const res = await downloadAllFromCloud();
      showSuccess(`Download concluído com sucesso! ${res.booksDownloaded} livros, ${res.studentsDownloaded} alunos e ${res.loansDownloaded} empréstimos sincronizados neste computador!`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      showError(`Erro ao baixar dados da nuvem: ${err.message || 'Verifique a conexão'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearByDate = async () => {
    setIsProcessing(true);
    try {
      const monthLabel = months.find(m => m.value === cleanupMonth)?.label;
      const filterLabel = cleanupMonth === "all" ? cleanupYear : `${monthLabel} de ${cleanupYear}`;
      
      showSuccess(`Iniciando limpeza dos registros de ${filterLabel}...`);
      
      // 1. Obter empréstimos tanto do banco local quanto do Firestore
      const localLoans = getLocalCollection<Loan>('loans');
      let remoteLoans: Loan[] = [];
      try {
        remoteLoans = await getAll<Loan>('loans');
      } catch (e) {
        console.warn('[Cleanup] Não foi possível buscar diretamente do Firestore, usando banco local:', e);
      }

      // Unifica por ID para garantir que não falte nenhum registro
      const loansMap = new Map<string, Loan>();
      localLoans.forEach(l => { if (l && l.id) loansMap.set(l.id, l); });
      remoteLoans.forEach(l => { if (l && l.id) loansMap.set(l.id, l); });
      const allLoans = Array.from(loansMap.values());

      const targetYear = cleanupYear.trim();
      const targetMonth = cleanupMonth;

      const matchesPeriod = (dateStr?: string) => {
        if (!dateStr) return false;
        const str = String(dateStr).trim();

        // 1. Formato ISO ou prefixo (ex: "2026-09" ou "2026")
        if (targetMonth === "all") {
          if (str.startsWith(targetYear) || str.includes(`/${targetYear}`) || str.includes(`-${targetYear}`)) {
            return true;
          }
        } else {
          const monthPad = targetMonth.padStart(2, '0');
          if (str.startsWith(`${targetYear}-${monthPad}`) || str.includes(`/${monthPad}/${targetYear}`)) {
            return true;
          }
        }

        // 2. Parse robusto via Date
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          const yMatches = d.getFullYear().toString() === targetYear;
          if (!yMatches) return false;
          if (targetMonth === "all") return true;
          const mMatches = (d.getMonth() + 1).toString().padStart(2, '0') === targetMonth.padStart(2, '0');
          return mMatches;
        }

        return false;
      };

      const loansToDelete = allLoans.filter(loan => 
        matchesPeriod(loan?.loanDate) || 
        (!loan?.loanDate && matchesPeriod(loan?.expectedReturnDate))
      );

      if (loansToDelete.length === 0) {
        showSuccess(`Nenhum registro encontrado para ${filterLabel}.`);
        setIsProcessing(false);
        return;
      }

      console.log(`[Cleanup] Excluindo ${loansToDelete.length} registros para ${filterLabel}...`);
      
      const idsToDelete = new Set(loansToDelete.map(l => l.id));

      // 1. Remove do armazenamento local imediatamente para refletir na interface
      const updatedLocalLoans = localLoans.filter(l => !idsToDelete.has(l.id));
      saveLocalCollection('loans', updatedLocalLoans);

      // 2. Enfileira operações de exclusão para sincronização com a nuvem
      loansToDelete.forEach(loan => {
        enqueueSyncOperation({
          collection: 'loans',
          docId: loan.id,
          action: 'delete',
        });
      });

      // 3. Tenta deletar diretamente no Firestore também
      const chunkSize = 15;
      for (let i = 0; i < loansToDelete.length; i += chunkSize) {
        const chunk = loansToDelete.slice(i, i + chunkSize);
        await Promise.allSettled(chunk.map(loan => deleteDocument('loans', loan.id)));
      }

      // 4. Executa processo da fila
      processSyncQueue().catch(() => {});

      showSuccess(`${loansToDelete.length} registros de ${filterLabel} foram removidos com sucesso!`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error('Erro ao limpar dados:', error);
      showError(`Erro ao limpar dados: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsProcessing(false);
    }
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
        {/* Sincronização em Nuvem (Multi-computadores) */}
        <Card className="md:col-span-2 lg:col-span-3 border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CloudUpload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-xl">Sincronização entre Computadores (Rede / Nuvem)</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Use esta seção para compartilhar todos os cadastros de livros, alunos e empréstimos entre computadores diferentes da biblioteca.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 bg-background border rounded-lg flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <CloudUpload className="h-4 w-4" /> Computador Principal (com os cadastros)
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Clique abaixo no PC onde você já cadastrou os livros e alunos para enviar tudo à nuvem. Os outros computadores receberão tudo imediatamente.
                  </p>
                </div>
                <Button onClick={handleUploadAllToCloud} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                  <CloudUpload className="mr-2 h-4 w-4" />
                  {isProcessing ? 'Enviando...' : 'Enviar Dados Deste PC para a Nuvem'}
                </Button>
              </div>

              <div className="p-4 bg-background border rounded-lg flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CloudDownload className="h-4 w-4" /> Segundo Computador (que precisa ver tudo)
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Clique abaixo no computador que não está visualizando os dados para forçar o download completo de tudo o que está na nuvem.
                  </p>
                </div>
                <Button onClick={handleDownloadAllFromCloud} variant="outline" disabled={isProcessing} className="border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 w-full">
                  <CloudDownload className="mr-2 h-4 w-4" />
                  {isProcessing ? 'Baixando...' : 'Baixar Dados da Nuvem para Este PC'}
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/60 p-3 rounded-md flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Sincronização Automática:</strong> Assim que a nuvem estiver com os dados, ambos os computadores sincronizam automaticamente em tempo real sempre que você adicionar, editar ou emprestar livros!
              </span>
            </div>
          </CardContent>
        </Card>

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
            <div className="p-4 border rounded-lg border-red-200 bg-red-50 dark:bg-red-900/10">
              <h4 className="font-semibold text-red-600">Manutenção do Sistema</h4>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Remover registros de empréstimos por período específico.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Mês</label>
                  <Select value={cleanupMonth} onValueChange={setCleanupMonth}>
                    <SelectTrigger className="bg-white dark:bg-slate-950">
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Ano</label>
                  <Input 
                    type="number" 
                    value={cleanupYear} 
                    onChange={(e) => setCleanupYear(e.target.value)}
                    className="bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isProcessing}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpar Dados do Período
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Limpeza</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerápermanentemente todos os empréstimos registrados em 
                      <strong> {cleanupMonth === "all" ? cleanupYear : `${months.find(m => m.value === cleanupMonth)?.label} de ${cleanupYear}`}</strong>. 
                      A ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearByDate}>
                      Sim, Limpar Dados
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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