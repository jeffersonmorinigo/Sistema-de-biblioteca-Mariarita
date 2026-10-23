import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  getSyncQueue,
  dequeueSyncOperation,
  saveLocalCollection,
  getLocalCollection,
  getLocalSettings,
  saveLocalSettings,
  defaultSettings,
  getLocalDeletedIds,
  unmarkLocalDeleted,
  clearLocalDeletedIds,
  enqueueSyncOperation,
  SyncItem,
} from './localDb';
import { AppSettings } from './firestoreService';
import { Book, Student, Loan, User } from './types';

export type SyncStatus = 'online' | 'offline' | 'syncing';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime: Date | null;
  error: string | null;
}

const SETTINGS_DOC_ID = 'app_settings';

let currentState: SyncState = {
  status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  pendingCount: getSyncQueue().length,
  lastSyncTime: null,
  error: null,
};

const listeners = new Set<(state: SyncState) => void>();

function notifyListeners() {
  currentState.pendingCount = getSyncQueue().length;
  listeners.forEach((listener) => {
    try {
      listener({ ...currentState });
    } catch (e) {
      console.error('[SyncService] Erro ao notificar listener:', e);
    }
  });
}

function updateState(updates: Partial<SyncState>) {
  currentState = { ...currentState, ...updates };
  notifyListeners();
}

/**
 * Assina mudanças no status de sincronização (para Badges, Headers, etc.)
 */
export function subscribeToSyncStatus(callback: (state: SyncState) => void): () => void {
  listeners.add(callback);
  callback({ ...currentState });
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Retorna o estado atual de sincronização
 */
export function getSyncState(): SyncState {
  currentState.pendingCount = getSyncQueue().length;
  return { ...currentState };
}

/**
 * Higieniza os dados antes de gravar no Firestore para evitar que
 * regras de validação ou campos vazios/undefined causem permission-denied.
 */
export function sanitizeDataForFirestore(collectionName: string, rawData: any): any {
  if (!rawData || typeof rawData !== 'object') return {};
  const { id, ...data } = rawData;

  if (collectionName === 'books') {
    const title = String(data.title || '').trim() || 'LIVRO SEM TÍTULO';
    const author = String(data.author || '').trim() || 'AUTOR NÃO INFORMADO';
    const category = String(data.category || '').trim() || 'GERAL';
    const code = String(data.code || data.isbn || `COD_${Date.now()}`).trim();
    const shelf = String(data.shelf || '').trim() || 'GERAL';
    const bookType = String(data.bookType || '').trim() || 'LIVRO';
    const publisher = String(data.publisher || '').trim() || 'N/A';
    const isbn = String(data.isbn || '').trim();
    const quantity = Number(data.quantity) > 0 ? Math.floor(Number(data.quantity)) : 1;

    return {
      title,
      author,
      category,
      shelf,
      code,
      bookType,
      publisher,
      isbn,
      quantity,
      isDeleted: false,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
  }

  if (collectionName === 'students') {
    const name = String(data.name || '').trim() || 'NOME NÃO INFORMADO';
    const studentClass = String(data.class || '').trim() || 'GERAL';
    const type = String(data.type || '').trim() || 'ALUNO';
    const isBlocked = Boolean(data.isBlocked);
    const blockDate = data.blockDate ? String(data.blockDate) : null;

    return {
      name,
      class: studentClass,
      type,
      isBlocked,
      blockDate,
      isDeleted: false,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
  }

  if (collectionName === 'loans') {
    return {
      bookId: String(data.bookId || '').trim(),
      studentId: String(data.studentId || '').trim(),
      bookTitle: String(data.bookTitle || '').trim(),
      studentName: String(data.studentName || '').trim(),
      bookCode: String(data.bookCode || '').trim(),
      loanDate: data.loanDate || new Date().toISOString(),
      expectedReturnDate: data.expectedReturnDate || new Date().toISOString(),
      returnDate: data.returnDate || null,
      status: data.status || 'active',
      isDeleted: false,
      updatedAt: new Date().toISOString(),
    };
  }

  if (collectionName === 'users') {
    return {
      name: String(data.name || 'Usuário').trim(),
      email: String(data.email || '').trim().toLowerCase(),
      password: String(data.password || '').trim(),
      isDeleted: false,
      status: 'active',
    };
  }

  return { ...data, isDeleted: false, status: 'active' };
}

let isProcessingQueue = false;

/**
 * Processa itens que foram alterados offline e envia para o Firestore
 */
export async function processSyncQueue(): Promise<void> {
  if (isProcessingQueue) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateState({ status: 'offline' });
    return;
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    updateState({ status: 'online', error: null });
    return;
  }

  isProcessingQueue = true;
  updateState({ status: 'syncing', error: null });

  try {
    for (const item of queue) {
      try {
        if (item.action === 'add' || item.action === 'update') {
          const docRef = doc(db, item.collection, item.docId);
          const sanitized = sanitizeDataForFirestore(item.collection, item.data || {});
          await setDoc(docRef, sanitized, { merge: true });
          dequeueSyncOperation(item.id);
        } else if (item.action === 'delete') {
          const docRef = doc(db, item.collection, item.docId);
          try {
            await deleteDoc(docRef);
          } catch (delErr: any) {
            // Se o Firestore bloquear exclusão física (regras de segurança), aplica soft-delete preservando integridade
            console.warn(`[SyncService] Delete físico em ${item.collection}/${item.docId}, aplicando soft-delete...`);
            await setDoc(docRef, { isDeleted: true, status: 'deleted' }, { merge: true }).catch(() => {});
          }
          dequeueSyncOperation(item.id);
        } else if (item.action === 'setSettings') {
          const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
          await setDoc(docRef, item.data || {}, { merge: true });
          dequeueSyncOperation(item.id);
        }
      } catch (itemErr: any) {
        console.warn(`[SyncService] Erro ao sincronizar item individual (${item.action} em ${item.collection}):`, itemErr);
        // Tenta sanitizar e reenviar em caso de erro de permissão por formato inválido
        if (item.action === 'add' || item.action === 'update') {
          try {
            const docRef = doc(db, item.collection, item.docId);
            const fallbackSanitized = sanitizeDataForFirestore(item.collection, item.data || {});
            await setDoc(docRef, fallbackSanitized, { merge: true });
            dequeueSyncOperation(item.id);
            continue;
          } catch (retryErr) {
            console.error('[SyncService] Falha na segunda tentativa de envio:', retryErr);
          }
        }
        dequeueSyncOperation(item.id);
      }
    }

    updateState({
      status: 'online',
      pendingCount: getSyncQueue().length,
      lastSyncTime: new Date(),
      error: null,
    });
  } catch (err: any) {
    console.warn('[SyncService] Erro ao sincronizar fila com Firebase:', err);
    updateState({
      status: 'offline',
      pendingCount: getSyncQueue().length,
      error: err?.message || 'Falha ao sincronizar com nuvem',
    });
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Sincroniza uma coleção específica da nuvem para o banco local.
 * Garante reconciliação bidirecional:
 * 1. Puxa novos itens da nuvem para o computador local.
 * 2. Se o computador local tiver itens que ainda não estão na nuvem, faz o upload automático.
 */
export function startCollectionSync<T extends { id: string }>(
  collectionName: string,
  onDataUpdate?: (data: T[]) => void
): Unsubscribe {
  // Retorna imediatamente os dados locais
  const initialLocal = getLocalCollection<T>(collectionName);
  if (onDataUpdate) {
    onDataUpdate(initialLocal);
  }

  const colRef = collection(db, collectionName);

  return onSnapshot(
    colRef,
    (snapshot) => {
      // Itens válidos que vêm do Firebase (ignora documentos com flag isDeleted ou status deleted)
      const cloudItems = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        .filter((item: any) => !item.isDeleted && item.status !== 'deleted') as T[];

      const deletedLocalIds = getLocalDeletedIds(collectionName);
      const pendingSyncOps = getSyncQueue().filter((q) => q.collection === collectionName);
      const deletedDocIds = new Set([
        ...pendingSyncOps.filter((q) => q.action === 'delete').map((q) => q.docId),
        ...deletedLocalIds,
      ]);

      const localItems = getLocalCollection<T>(collectionName);

      // 1. Mapeia todos os itens da nuvem
      const mergedMap = new Map<string, T>();
      cloudItems.forEach((cloudItem) => {
        // Se está ativo na nuvem, desmarca de deletados locais acidentalmente
        if (deletedLocalIds.has(cloudItem.id)) {
          unmarkLocalDeleted(collectionName, cloudItem.id);
        }
        mergedMap.set(cloudItem.id, cloudItem);
      });

      // 2. Local-first reconciliation:
      // Se este PC tem itens locais válidos que NÃO foram deletados e NÃO estão na nuvem,
      // preserva-os e agenda o upload para que o outro PC receba!
      const itemsToUpload: T[] = [];
      localItems.forEach((localItem) => {
        if (!deletedDocIds.has(localItem.id)) {
          if (!mergedMap.has(localItem.id)) {
            mergedMap.set(localItem.id, localItem);
            itemsToUpload.push(localItem);
          }
        }
      });

      const mergedList = Array.from(mergedMap.values());
      saveLocalCollection(collectionName, mergedList, false);

      updateState({
        status: 'online',
        lastSyncTime: new Date(),
        error: null,
      });

      if (onDataUpdate) {
        onDataUpdate(mergedList);
      }

      // Se havia itens locais sem presença na nuvem, envia para o Firebase
      if (itemsToUpload.length > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
        console.log(`[SyncService] Reconciliando: ${itemsToUpload.length} itens de "${collectionName}" enviados para a nuvem.`);
        itemsToUpload.forEach((item) => {
          enqueueSyncOperation({
            collection: collectionName,
            docId: item.id,
            action: 'add',
            data: item,
          });
        });
        processSyncQueue().catch(() => {});
      }
    },
    (error) => {
      console.warn(`[SyncService] Snapshot error em ${collectionName} (usando dados locais):`, error);
      updateState({ status: 'offline' });
      const local = getLocalCollection<T>(collectionName);
      if (onDataUpdate) {
        onDataUpdate(local);
      }
    }
  );
}

/**
 * Sincroniza configurações da nuvem para o local
 */
export function startSettingsSync(
  onSettingsUpdate?: (settings: AppSettings) => void
): Unsubscribe {
  const localSettings = getLocalSettings();
  if (onSettingsUpdate) {
    onSettingsUpdate(localSettings);
  }

  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);

  return onSnapshot(
    docRef,
    (docSnap) => {
      const pendingSettingsOps = getSyncQueue().filter((q) => q.collection === 'settings');
      if (pendingSettingsOps.length > 0) {
        console.log('[SyncService] Settings pendentes na fila de sync; mantendo dados locais atuais.');
        return;
      }

      if (docSnap.exists()) {
        const cloudSettings = docSnap.data() as AppSettings;
        const currentLocal = getLocalSettings();

        const merged: AppSettings = {
          schoolName: typeof cloudSettings.schoolName === 'string' && cloudSettings.schoolName.trim()
            ? cloudSettings.schoolName
            : (currentLocal.schoolName || defaultSettings.schoolName),
          book_categories: Array.isArray(cloudSettings.book_categories) && cloudSettings.book_categories.length > 0
            ? cloudSettings.book_categories
            : (Array.isArray(currentLocal.book_categories) && currentLocal.book_categories.length > 0 ? currentLocal.book_categories : defaultSettings.book_categories),
          student_classes: Array.isArray(cloudSettings.student_classes) && cloudSettings.student_classes.length > 0
            ? cloudSettings.student_classes
            : (Array.isArray(currentLocal.student_classes) && currentLocal.student_classes.length > 0 ? currentLocal.student_classes : defaultSettings.student_classes),
          book_shelves: Array.isArray(cloudSettings.book_shelves) && cloudSettings.book_shelves.length > 0
            ? cloudSettings.book_shelves
            : (Array.isArray(currentLocal.book_shelves) && currentLocal.book_shelves.length > 0 ? currentLocal.book_shelves : defaultSettings.book_shelves),
          book_types: Array.isArray(cloudSettings.book_types) && cloudSettings.book_types.length > 0
            ? cloudSettings.book_types
            : (Array.isArray(currentLocal.book_types) && currentLocal.book_types.length > 0 ? currentLocal.book_types : defaultSettings.book_types),
          barcodeScanner: cloudSettings.barcodeScanner || currentLocal.barcodeScanner || defaultSettings.barcodeScanner,
        };

        saveLocalSettings(merged, false);
        if (onSettingsUpdate) {
          onSettingsUpdate(merged);
        }
      } else {
        setDoc(docRef, localSettings, { merge: true }).catch(() => {});
      }
      updateState({ status: 'online', lastSyncTime: new Date() });
    },
    (error) => {
      console.warn('[SyncService] Erro ao sincronizar settings (usando dados locais):', error);
      updateState({ status: 'offline' });
      if (onSettingsUpdate) {
        onSettingsUpdate(getLocalSettings());
      }
    }
  );
}

/**
 * Envia 100% de todos os cadastros existentes neste computador (livros, alunos, empréstimos, usuários e configurações)
 * para o Firestore.
 * Ideal para ser acionado pelo botão "Sincronizar com Outros PCs" no computador onde os dados foram cadastrados.
 */
export async function uploadAllLocalDataToCloud(): Promise<{
  booksUploaded: number;
  studentsUploaded: number;
  loansUploaded: number;
  settingsUploaded: boolean;
  total: number;
}> {
  updateState({ status: 'syncing' });

  let booksUploaded = 0;
  let studentsUploaded = 0;
  let loansUploaded = 0;
  let settingsUploaded = false;

  try {
    // 1. Livros locais
    const localBooks = getLocalCollection<Book>('books');
    for (const book of localBooks) {
      if (!book || !book.id) continue;
      unmarkLocalDeleted('books', book.id);
      const docRef = doc(db, 'books', book.id);
      const sanitized = sanitizeDataForFirestore('books', book);
      await setDoc(docRef, sanitized, { merge: true });
      booksUploaded++;
    }

    // 2. Alunos locais
    const localStudents = getLocalCollection<Student>('students');
    for (const student of localStudents) {
      if (!student || !student.id) continue;
      unmarkLocalDeleted('students', student.id);
      const docRef = doc(db, 'students', student.id);
      const sanitized = sanitizeDataForFirestore('students', student);
      await setDoc(docRef, sanitized, { merge: true });
      studentsUploaded++;
    }

    // 3. Empréstimos locais
    const localLoans = getLocalCollection<Loan>('loans');
    for (const loan of localLoans) {
      if (!loan || !loan.id) continue;
      unmarkLocalDeleted('loans', loan.id);
      const docRef = doc(db, 'loans', loan.id);
      const sanitized = sanitizeDataForFirestore('loans', loan);
      await setDoc(docRef, sanitized, { merge: true });
      loansUploaded++;
    }

    // 4. Usuários locais
    const localUsers = getLocalCollection<User>('users');
    for (const user of localUsers) {
      if (!user || !user.id) continue;
      unmarkLocalDeleted('users', user.id);
      const docRef = doc(db, 'users', user.id);
      const sanitized = sanitizeDataForFirestore('users', user);
      await setDoc(docRef, sanitized, { merge: true });
    }

    // 5. Configurações locais
    const localSettings = getLocalSettings();
    const settingsDocRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(settingsDocRef, localSettings, { merge: true });
    settingsUploaded = true;

    // Também processa eventuais pendências na fila
    await processSyncQueue();

    updateState({
      status: 'online',
      lastSyncTime: new Date(),
      error: null,
    });

    return {
      booksUploaded,
      studentsUploaded,
      loansUploaded,
      settingsUploaded,
      total: booksUploaded + studentsUploaded + loansUploaded,
    };
  } catch (error: any) {
    console.error('[SyncService] Erro ao enviar todos os dados para a nuvem:', error);
    updateState({
      status: 'offline',
      error: error?.message || 'Erro ao enviar dados para a nuvem',
    });
    throw error;
  }
}

/**
 * Baixa todos os cadastros da nuvem e substitui / atualiza o banco local.
 * Ideal para ser acionado pelo outro computador para puxar tudo imediatamente.
 */
export async function downloadAllFromCloud(): Promise<{
  booksDownloaded: number;
  studentsDownloaded: number;
  loansDownloaded: number;
  total: number;
}> {
  updateState({ status: 'syncing' });

  try {
    // 1. Limpa eventuais marcadores de exclusão para permitir restauração completa
    clearLocalDeletedIds('books');
    clearLocalDeletedIds('students');
    clearLocalDeletedIds('loans');

    // 2. Livros
    const booksSnap = await getDocs(collection(db, 'books'));
    const books = booksSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((b: any) => !b.isDeleted && b.status !== 'deleted') as Book[];
    saveLocalCollection('books', books);

    // 3. Alunos
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s: any) => !s.isDeleted && s.status !== 'deleted') as Student[];
    saveLocalCollection('students', students);

    // 4. Empréstimos
    const loansSnap = await getDocs(collection(db, 'loans'));
    const loans = loansSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((l: any) => !l.isDeleted && l.status !== 'deleted') as Loan[];
    saveLocalCollection('loans', loans);

    // 5. Usuários
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u: any) => !u.isDeleted && u.status !== 'deleted') as User[];
    if (users.length > 0) {
      saveLocalCollection('users', users);
    }

    // 6. Configurações
    const settingsDoc = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID));
    if (settingsDoc.exists()) {
      saveLocalSettings(settingsDoc.data() as AppSettings);
    }

    updateState({
      status: 'online',
      lastSyncTime: new Date(),
      error: null,
    });

    return {
      booksDownloaded: books.length,
      studentsDownloaded: students.length,
      loansDownloaded: loans.length,
      total: books.length + students.length + loans.length,
    };
  } catch (error: any) {
    console.error('[SyncService] Erro ao baixar dados da nuvem:', error);
    updateState({
      status: 'offline',
      error: error?.message || 'Erro ao baixar dados da nuvem',
    });
    throw error;
  }
}

/**
 * Força uma sincronização manual imediata e reconcilia dados locais com a nuvem
 */
export async function syncNow(): Promise<void> {
  updateState({ status: 'syncing' });
  await processSyncQueue();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const collections = ['books', 'students', 'loans', 'users'];
      for (const col of collections) {
        const localItems = getLocalCollection(col);
        const deletedIds = getLocalDeletedIds(col);
        localItems.forEach((item: any) => {
          if (item?.id && !deletedIds.has(item.id)) {
            enqueueSyncOperation({
              collection: col,
              docId: item.id,
              action: 'add',
              data: item,
            });
          }
        });
      }
      await processSyncQueue();
    } catch (e) {
      console.warn('[SyncService] Erro na reconciliação manual do syncNow:', e);
    }
  }
}


// ========== LISTENERS DE REDE ==========

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncService] Conexão restabelecida. Processando sincronização...');
    updateState({ status: 'online' });
    processSyncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[SyncService] Sem conexão com a internet. Ativando modo local.');
    updateState({ status: 'offline' });
  });

  // Tenta processar a fila a cada 30 segundos se houver pendências
  setInterval(() => {
    if (getSyncQueue().length > 0 && navigator.onLine) {
      processSyncQueue();
    }
  }, 30000);

  // Processa fila no carregamento inicial
  setTimeout(() => {
    if (navigator.onLine) {
      processSyncQueue();
    }
  }, 2000);
}
