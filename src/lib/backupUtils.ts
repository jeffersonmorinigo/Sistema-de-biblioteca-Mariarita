import { format } from 'date-fns';
import { getAll, getSettings, updateSettings, addDocument, deleteDocument } from './firestoreService';
import { Book, Student, Loan, User } from './types';

/**
 * Coleta todos os dados do Firestore para backup.
 */
const getAllData = async () => {
  const [books, students, loans, users, settings] = await Promise.all([
    getAll('books'),
    getAll('students'),
    getAll('loans'),
    getAll('users'),
    getSettings(),
  ]);

  return {
    books,
    students,
    loans,
    users,
    schoolName: settings.schoolName,
    book_categories: settings.book_categories,
    student_classes: settings.student_classes,
    book_shelves: settings.book_shelves,
    book_types: settings.book_types,
  };
};

const escapeSql = (str: any) => {
  if (str === null || typeof str === 'undefined') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
};

/**
 * Gera e força o download de um arquivo de backup JSON vindo do Firestore.
 */
export const generateAndDownloadJsonBackup = async (prefix: string) => {
  try {
    const backupData = await getAllData();
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
    console.error('Erro ao gerar backup JSON do Firestore:', error);
    return false;
  }
};

/**
 * Gera e força o download de um arquivo de backup SQL vindo do Firestore.
 */
export const generateAndDownloadSqlBackup = async (prefix: string) => {
  try {
    const data = await getAllData();
    let sqlString = `-- Backup do Sistema de Biblioteca (Firestore)\n`;
    sqlString += `-- Gerado em: ${new Date().toISOString()}\n\n`;

    // Helper to generate table SQL
    const generateTableSql = (tableName: string, columns: string[], items: any[]) => {
      if (!items || items.length === 0) return '';
      let tableSql = `DROP TABLE IF EXISTS ${tableName};\n`;
      tableSql += `CREATE TABLE ${tableName} (\n  ${columns.map(c => `${c} TEXT`).join(',\n  ')}\n);\n\n`;
      items.forEach(item => {
        const values = columns.map(col => escapeSql(item[col])).join(', ');
        tableSql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});\n`;
      });
      return tableSql + '\n';
    };

    sqlString += generateTableSql('users', ['id', 'name', 'email', 'password'], data.users);
    sqlString += generateTableSql('students', ['id', 'name', 'class', 'type', 'isBlocked', 'blockDate'], data.students);
    sqlString += generateTableSql('books', ['id', 'code', 'isbn', 'title', 'author', 'publisher', 'shelf', 'category', 'bookType', 'quantity'], data.books);
    sqlString += generateTableSql('loans', ['id', 'studentId', 'bookCode', 'loanDate', 'expectedReturnDate', 'returnDate'], data.loans);

    // Handle settings
    sqlString += `DROP TABLE IF EXISTS settings;\n`;
    sqlString += `CREATE TABLE settings (\n  key TEXT PRIMARY KEY,\n  value TEXT\n);\n\n`;

    const settingsEntries = [
      ['schoolName', data.schoolName],
      ['book_categories', JSON.stringify(data.book_categories)],
      ['student_classes', JSON.stringify(data.student_classes)],
      ['book_shelves', JSON.stringify(data.book_shelves)],
      ['book_types', JSON.stringify(data.book_types)],
    ];

    settingsEntries.forEach(([key, value]) => {
      if (value) {
        sqlString += `INSERT INTO settings (key, value) VALUES ('${key}', ${escapeSql(value)});\n`;
      }
    });

    const blob = new Blob([sqlString], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    link.href = url;
    link.download = `${prefix}_biblioteca_${timestamp}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Erro ao gerar backup SQL do Firestore:', error);
    return false;
  }
};

/**
 * Restaura os dados do Firestore a partir de um objeto de backup.
 * @param backupData Dados do backup
 */
export const restoreFromBackup = async (backupData: any) => {
  try {
    // 1. Restaurar Configurações
    const settings: any = {};
    if (backupData.schoolName) settings.schoolName = backupData.schoolName;
    if (backupData.book_categories) settings.book_categories = backupData.book_categories;
    if (backupData.student_classes) settings.student_classes = backupData.student_classes;
    if (backupData.book_shelves) settings.book_shelves = backupData.book_shelves;
    if (backupData.book_types) settings.book_types = backupData.book_types;

    await updateSettings(settings);

    // 2. Restaurar Coleções (Limpar e Adicionar)
    const collectionsToRestore = ['books', 'students', 'loans', 'users'];

    for (const colName of collectionsToRestore) {
      if (backupData[colName] && Array.isArray(backupData[colName])) {
        // Obter todos os IDs atuais e deletar
        const currentData = await getAll(colName);
        for (const item of currentData) {
          await deleteDocument(colName, (item as any).id);
        }

        // Adicionar novos dados
        for (const item of backupData[colName]) {
          const { id, ...dataWithoutId } = item;
          await addDocument(colName, dataWithoutId);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Erro ao restaurar backup no Firestore:', error);
    throw error;
  }
};