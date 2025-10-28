import { useEffect } from 'react';
import { generateAndDownloadJsonBackup } from '@/lib/backupUtils';
import { showSuccess } from '@/utils/toast';

// Chave para garantir que o backup só seja feito uma vez por sessão de execução
const SESSION_KEY = 'initialBackupDone';

export function useInitialBackup() {
  useEffect(() => {
    // Verifica se estamos no Electron (ou em um ambiente onde o download é permitido)
    if (typeof window !== 'undefined' && window.electron) {
      // Verifica se o backup já foi feito nesta sessão
      if (sessionStorage.getItem(SESSION_KEY) === 'true') {
        return;
      }

      // Dispara o backup
      const success = generateAndDownloadJsonBackup('backup_inicial');
      
      if (success) {
        showSuccess('Backup inicial gerado com sucesso!');
        sessionStorage.setItem(SESSION_KEY, 'true');
      }
    }
  }, []);
}