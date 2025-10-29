import { format } from 'date-fns';

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

const escapeSql = (str: any) => {
  if (str === null || typeof str === 'undefined') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
};

/**
 * Gera e força o download de um arquivo de backup JSON.
 * @param prefix Prefixo do nome do arquivo (ex: 'backup_inicial', 'backup_manual')
 * @returns true se o download foi iniciado, false em caso de erro.
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
    return false;
  }
};

/**
 * Gera e força o download de um arquivo de backup SQL.
 * @param prefix Prefixo do nome do arquivo (ex: 'backup_inicial', 'backup_manual')
 * @returns true se o download foi iniciado, false em caso de erro.
 */
export const generateAndDownloadSqlBackup = (prefix: string) => {
  try {
    const data = getAllData();
    let sqlString = `-- Backup do Sistema de Biblioteca\n`;
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
    if (data.schoolName) {
      sqlString += `INSERT INTO settings (key, value) VALUES ('schoolName', ${escapeSql(data.schoolName)});\n`;
    }
    if (data.book_categories) {
      sqlString += `INSERT INTO settings (key, value) VALUES ('book_categories', ${escapeSql(JSON.stringify(data.book_categories))});\n`;
    }
    if (data.student_classes) {
      sqlString += `INSERT INTO settings (key, value) VALUES ('student_classes', ${escapeSql(JSON.stringify(data.student_classes))});\n`;
    }
    if (data.book_shelves) {
      sqlString += `INSERT INTO settings (key, value) VALUES ('book_shelves', ${escapeSql(JSON.stringify(data.book_shelves))});\n`;
    }

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
    console.error('Erro ao gerar backup SQL:', error);
    return false;
  }
};