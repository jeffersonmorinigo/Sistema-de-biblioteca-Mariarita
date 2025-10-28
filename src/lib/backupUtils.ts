import { format } from 'date-fns';
import { showSuccess, showError } from '@/utils/toast';

const LOCAL_STORAGE_KEYS = [
  'books', 'students', 'loans', 'users', 
  'schoolName', 'book_categories', 'student_classes', 'book_shelves',
  'isAuthenticated'
];

const getAllData = () => {
  const data: { [key: string]: any } = {};
  LOCAL_STORAGE_KEYS.forEach(key => {
    const item = localStorage.getItem(key);
    if (item) {
      try {
        data[key] = JSON.parse(item);
      } catch (e) {
        console.warn(`Could not parse localStorage item: ${key}`);
      }
    }
  });
  return data;
};

/**
 * Gera e força o download de um arquivo de backup JSON.
 * @param prefix Prefixo do nome do arquivo (ex: 'backup_inicial', 'backup_manual')
 */
export const generateAndDownloadJsonBackup = (prefix: string) => {
  try {
    const backupData = getAllData();
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    link.href = url;
    link.download = `${prefix}_biblioteca_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Erro ao gerar backup JSON:', error);
    showError('Ocorreu um erro ao gerar o backup JSON.');
    return false;
  }
};