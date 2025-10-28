import { useCallback } from 'react';
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';

const LOCAL_STORAGE_KEYS = [
  'books', 'students', 'loans', 'users',
  'schoolName', 'book_categories', 'student_classes', 'book_shelves', // New: Added book_shelves
  'isAuthenticated'
];

export function useAutoBackup() {
  const triggerJsonBackup = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      try {
        const data: { [key: string]: any } = {};
        LOCAL_STORAGE_KEYS.forEach(key => {
          const item = localStorage.getItem(key);
          if (item) {
            try {
              data[key] = JSON.parse(item);
            } catch (e) {
              console.warn(`Não foi possível analisar o item do localStorage: ${key}`, e);
            }
          }
        });

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        link.href = url;
        link.download = `backup_biblioteca_auto_${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showSuccess('Backup automático gerado com sucesso!');
        resolve();
      } catch (error) {
        console.error('Erro ao gerar backup automático JSON:', error);
        showError('Ocorreu um erro ao gerar o backup automático JSON.');
        reject(error);
      }
    });
  }, []);

  return { triggerJsonBackup };
}