import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download } from 'lucide-react';
import { generateAndDownloadJsonBackup, generateAndDownloadSqlBackup } from '@/lib/backupUtils';
import { showSuccess, showError } from '@/utils/toast';

const SESSION_KEY = 'initialBackupDone';

const InitialBackupNotification = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backupAttempted, setBackupAttempted] = useState(false);

  useEffect(() => {
    // 1. Verifica se estamos no Electron
    if (typeof window !== 'undefined' && window.electron) {
      // 2. Verifica se o backup já foi feito nesta sessão
      if (sessionStorage.getItem(SESSION_KEY) === 'true') {
        return;
      }
      
      // 3. Se não foi feito, abre o modal
      setIsOpen(true);
    }
  }, []);

  const handleRunBackup = () => {
    setIsProcessing(true);
    setBackupAttempted(true);
    
    const jsonSuccess = generateAndDownloadJsonBackup('backup_inicial');
    const sqlSuccess = generateAndDownloadSqlBackup('backup_inicial');
    
    if (jsonSuccess && sqlSuccess) {
      showSuccess('Backups JSON e SQL gerados com sucesso! Verifique sua pasta de Downloads.');
      sessionStorage.setItem(SESSION_KEY, 'true');
    } else {
      showError('Falha ao gerar um ou ambos os backups iniciais. Tente novamente na página de Backup.');
    }
    
    setIsProcessing(false);
    setIsOpen(false);
  };
  
  // Se o backup já foi tentado e falhou, ou se o usuário fechar o modal, 
  // ele não deve reabrir até a próxima inicialização do app.
  const handleClose = () => {
    if (!backupAttempted) {
        // Se o usuário fechar sem tentar, marcamos como feito para não incomodar
        sessionStorage.setItem(SESSION_KEY, 'true');
    }
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            Atenção: Backup Inicial
          </DialogTitle>
          <DialogDescription>
            Detectamos que esta é a primeira execução do sistema nesta sessão. É crucial realizar um backup inicial dos seus dados.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
                Ao clicar em "Gerar Backups", dois arquivos (JSON e SQL) contendo todos os dados serão salvos na sua pasta de Downloads.
            </p>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Recomendamos fortemente que você faça isso agora.
            </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isProcessing}>
            Ignorar por enquanto
          </Button>
          <Button type="button" onClick={handleRunBackup} disabled={isProcessing}>
            <Download className="mr-2 h-4 w-4" />
            {isProcessing ? 'Gerando...' : 'Gerar Backups Agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InitialBackupNotification;