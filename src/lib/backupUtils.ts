import { format } from 'date-fns';
import { getAll, getSettings, updateSettings, addDocument, deleteDocument, setDocument } from './firestoreService';
import { getLocalCollection, getLocalSettings, saveLocalCollection, saveLocalSettings, defaultSettings } from './localDb';
import { Book, Student, Loan, User } from './types';

/**
 * Coleta todos os dados para backup (com fallback no banco local caso offline).
 */
const getAllData = async () => {
  try {
    const [books, students, loans, users, settings] = await Promise.all([
      getAll<Book>('books').catch(() => getLocalCollection<Book>('books')),
      getAll<Student>('students').catch(() => getLocalCollection<Student>('students')),
      getAll<Loan>('loans').catch(() => getLocalCollection<Loan>('loans')),
      getAll<User>('users').catch(() => getLocalCollection<User>('users')),
      getSettings().catch(() => getLocalSettings()),
    ]);

    return {
      books: books.length > 0 ? books : getLocalCollection<Book>('books'),
      students: students.length > 0 ? students : getLocalCollection<Student>('students'),
      loans: loans.length > 0 ? loans : getLocalCollection<Loan>('loans'),
      users: users.length > 0 ? users : getLocalCollection<User>('users'),
      schoolName: settings.schoolName || getLocalSettings().schoolName,
      book_categories: settings.book_categories || getLocalSettings().book_categories,
      student_classes: settings.student_classes || getLocalSettings().student_classes,
      book_shelves: settings.book_shelves || getLocalSettings().book_shelves,
      book_types: settings.book_types || getLocalSettings().book_types,
    };
  } catch (err) {
    console.warn('[Backup] Falha no Firestore, usando banco local:', err);
    const settings = getLocalSettings();
    return {
      books: getLocalCollection<Book>('books'),
      students: getLocalCollection<Student>('students'),
      loans: getLocalCollection<Loan>('loans'),
      users: getLocalCollection<User>('users'),
      schoolName: settings.schoolName,
      book_categories: settings.book_categories,
      student_classes: settings.student_classes,
      book_shelves: settings.book_shelves,
      book_types: settings.book_types,
    };
  }
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
 * Suporta formatos novos e antigos (legado).
 */
export const restoreFromBackup = async (backupData: any) => {
  try {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Arquivo de backup inválido.');
    }

    console.log('[Restore] Iniciando...', Object.keys(backupData));

    // 1. Mapeamento de Configurações (Garante compatibilidade total)
    const currentLocal = getLocalSettings();
    const settings: any = {};
    settings.schoolName = backupData.schoolName || backupData.school_name || backupData.nomeEscola || currentLocal.schoolName || defaultSettings.schoolName;

    // Mapeia todas as possíveis variações de nomes de chaves de configurações, preservando listas
    const restoredCategories = backupData.book_categories || backupData.categories || backupData.categoriasLivros || backupData.bookCategories;
    settings.book_categories = Array.isArray(restoredCategories) && restoredCategories.length > 0 
      ? restoredCategories 
      : (currentLocal.book_categories.length > 0 ? currentLocal.book_categories : defaultSettings.book_categories);

    const restoredClasses = backupData.student_classes || backupData.classes || backupData.turmasAlunos || backupData.studentClasses;
    settings.student_classes = Array.isArray(restoredClasses) && restoredClasses.length > 0 
      ? restoredClasses 
      : (currentLocal.student_classes.length > 0 ? currentLocal.student_classes : defaultSettings.student_classes);

    const restoredShelves = backupData.book_shelves || backupData.shelves || backupData.estantesLivros || backupData.bookShelves;
    settings.book_shelves = Array.isArray(restoredShelves) && restoredShelves.length > 0 
      ? restoredShelves 
      : (currentLocal.book_shelves.length > 0 ? currentLocal.book_shelves : defaultSettings.book_shelves);

    const restoredTypes = backupData.book_types || backupData.bookTypes || backupData.tiposLivros;
    settings.book_types = Array.isArray(restoredTypes) && restoredTypes.length > 0 
      ? restoredTypes 
      : (currentLocal.book_types.length > 0 ? currentLocal.book_types : defaultSettings.book_types);

    await updateSettings(settings).catch(() => {});
    saveLocalSettings(settings);
    console.log('[Restore] Configurações OK.');

    // 2. Mapeamento de Coleções Principais
    const mapping = {
      books: backupData.books || backupData.livros || [],
      students: backupData.students || backupData.alunos || [],
      loans: backupData.loans || backupData.emprestimos || [],
      users: backupData.users || backupData.usuarios || [],
    };

    for (const [colName, items] of Object.entries(mapping)) {
      if (!Array.isArray(items)) continue;

      console.log(`[Restore] Coleção "${colName}": ${items.length} itens encontrados.`);

      // Salva imediatamente no banco local
      saveLocalCollection(colName, items);

      // Limpar coleção atual na nuvem
      const currentData = await getAll(colName);
      if (currentData.length > 0) {
        console.log(`[Restore] Limpando ${currentData.length} itens de "${colName}"...`);
        // Deletar em pequenos grupos para não sobrecarregar
        const deleteChunkSize = 20;
        for (let i = 0; i < currentData.length; i += deleteChunkSize) {
          const chunk = currentData.slice(i, i + deleteChunkSize);
          await Promise.all(chunk.map(item => deleteDocument(colName, (item as any).id)));
        }
      }

      // Adicionar novos dados (Com sanitização para evitar erros de campos inválidos no Firestore)
      if (items.length > 0) {
        console.log(`[Restore] Enviando novos dados para "${colName}"...`);

        // Processa em paralelos moderados para performance e estabilidade
        const addChunkSize = 20;
        for (let i = 0; i < items.length; i += addChunkSize) {
          const chunk = items.slice(i, i + addChunkSize);
          await Promise.all(chunk.map(async (item) => {
            if (!item || typeof item !== 'object') return;

            // Preservar o ID original se existir para manter integridade das referências
            const originalId = item.id;
            const { id, ...cleanData } = item;

            // Sanitização básica campo a campo
            const sanitizedData: any = {};
            Object.entries(cleanData).forEach(([k, v]) => {
              if (v !== undefined) sanitizedData[k] = v;
            });

            try {
              if (originalId) {
                await setDocument(colName, originalId, sanitizedData);
              } else {
                await addDocument(colName, sanitizedData);
              }
            } catch (err) {
              console.error(`[Restore] Falha ao inserir item em ${colName}:`, err);
            }
          }));
        }
      }
    }

    console.log('[Restore] Restauração concluída!');
    return true;
  } catch (error: any) {
    console.error('[Restore] Erro Crítico:', error);
    throw new Error(`Falha na restauração: ${error.message || 'Erro de formato'}`);
  }
};