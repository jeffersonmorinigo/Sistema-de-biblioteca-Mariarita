import { AppSettings } from './firestoreService';

const DB_PREFIX = 'biblioteca_local_';
const CURRENT_PROJECT_VERSION = 'v2_sgebiblioteca';

// Limpa cache de dados do projeto antigo caso o usuário tenha dados no LocalStorage
if (typeof window !== 'undefined') {
  try {
    const savedVersion = localStorage.getItem('biblioteca_db_version');
    if (savedVersion !== CURRENT_PROJECT_VERSION) {
      localStorage.removeItem(`${DB_PREFIX}books`);
      localStorage.removeItem(`${DB_PREFIX}students`);
      localStorage.removeItem(`${DB_PREFIX}loans`);
      localStorage.removeItem(`${DB_PREFIX}sync_queue`);
      localStorage.setItem('biblioteca_db_version', CURRENT_PROJECT_VERSION);
    }
  } catch (e) {}
}

export interface SyncItem {
  id: string;
  docId: string;
  collection: string;
  action: 'add' | 'update' | 'delete' | 'setSettings';
  data?: any;
  timestamp: number;
}

export const defaultSettings: AppSettings = {
  schoolName: 'Escola Maria Rita',
  book_categories: ['LITERATURA', 'DIDÁTICO', 'INFANTIL', 'PESQUISA', 'GERAL'],
  student_classes: [
    '1º ANO A', '1º ANO B', '1º ANO C',
    '2º ANO A', '2º ANO B', '2º ANO C',
    '3º ANO A', '3º ANO B', '3º ANO C',
    '4º ANO A', '4º ANO B', '4º ANO C',
    '5º ANO A', '5º ANO B', '5º ANO C',
    '6º ANO A', '6º ANO B', '6º ANO C',
    '7º ANO A', '7º ANO B', '7º ANO C',
    '8º ANO A', '8º ANO B', '8º ANO C',
    '9º ANO A', '9º ANO B', '9º ANO C',
  ],
  book_shelves: ['PRATELEIRA 1', 'PRATELEIRA 2', 'PRATELEIRA 3', 'GERAL', 'N/A'],
  book_types: ['LIVRO', 'REVISTA', 'GIBI', 'DICIONÁRIO', 'ENCICLOPÉDIA', 'DIDÁTICO', 'PESQUISA', 'LITERATURA'],
  barcodeScanner: {
    enabled: true,
    targetField: 'code',
    autoOpenAddModal: true,
    autoFetchBookDetails: true,
  },
};

// Emite evento para que componentes reajam imediatamente à mudança no banco local
function notifyChange(collection: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('local-db-change', { detail: { collection } })
    );
  }
}

/**
 * Lê uma coleção completa do armazenamento local
 */
export function getLocalCollection<T extends { id: string }>(collectionName: string): T[] {
  try {
    const raw = localStorage.getItem(`${DB_PREFIX}${collectionName}`);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch (error) {
    console.warn(`[LocalDB] Erro ao ler coleção ${collectionName}:`, error);
    return [];
  }
}

/**
 * Salva uma coleção inteira no armazenamento local
 */
export function saveLocalCollection<T extends { id: string }>(
  collectionName: string,
  items: T[],
  emitEvent: boolean = true
): void {
  try {
    localStorage.setItem(`${DB_PREFIX}${collectionName}`, JSON.stringify(items));
    if (emitEvent) {
      notifyChange(collectionName);
    }
  } catch (error) {
    console.error(`[LocalDB] Erro ao salvar coleção ${collectionName}:`, error);
  }
}

/**
 * Adiciona ou substitui um item no banco local
 */
export function upsertLocalItem<T extends { id: string }>(
  collectionName: string,
  item: T,
  emitEvent: boolean = true
): void {
  const items = getLocalCollection<T>(collectionName);
  const index = items.findIndex((i) => i.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }
  saveLocalCollection(collectionName, items, emitEvent);
}

/**
 * Atualiza campos de um item no banco local
 */
export function updateLocalItem<T extends { id: string }>(
  collectionName: string,
  id: string,
  updates: Partial<T>,
  emitEvent: boolean = true
): void {
  const items = getLocalCollection<T>(collectionName);
  const index = items.findIndex((i) => i.id === id);
  if (index >= 0) {
    items[index] = { ...items[index], ...updates };
    saveLocalCollection(collectionName, items, emitEvent);
  }
}

/**
 * Remove um item do banco local
 */
export function removeLocalItem(
  collectionName: string,
  id: string,
  emitEvent: boolean = true
): void {
  const items = getLocalCollection(collectionName);
  const filtered = items.filter((i) => i.id !== id);
  saveLocalCollection(collectionName, filtered, emitEvent);
}

/**
 * Lê as configurações locais
 */
export function getLocalSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(`${DB_PREFIX}settings`);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return {
      schoolName: typeof parsed.schoolName === 'string' ? parsed.schoolName : defaultSettings.schoolName,
      book_categories: Array.isArray(parsed.book_categories)
        ? parsed.book_categories
        : defaultSettings.book_categories,
      student_classes: Array.isArray(parsed.student_classes)
        ? parsed.student_classes
        : defaultSettings.student_classes,
      book_shelves: Array.isArray(parsed.book_shelves)
        ? parsed.book_shelves
        : defaultSettings.book_shelves,
      book_types: Array.isArray(parsed.book_types)
        ? parsed.book_types
        : defaultSettings.book_types,
      barcodeScanner: parsed.barcodeScanner || defaultSettings.barcodeScanner,
    };
  } catch (error) {
    return defaultSettings;
  }
}

/**
 * Salva as configurações locais
 */
export function saveLocalSettings(settings: Partial<AppSettings>, emitEvent: boolean = true): void {
  try {
    const current = getLocalSettings();
    const updated: AppSettings = {
      ...current,
      ...settings,
      book_categories: Array.isArray(settings.book_categories) ? settings.book_categories : (current.book_categories ?? defaultSettings.book_categories),
      student_classes: Array.isArray(settings.student_classes) ? settings.student_classes : (current.student_classes ?? defaultSettings.student_classes),
      book_shelves: Array.isArray(settings.book_shelves) ? settings.book_shelves : (current.book_shelves ?? defaultSettings.book_shelves),
      book_types: Array.isArray(settings.book_types) ? settings.book_types : (current.book_types ?? defaultSettings.book_types),
      barcodeScanner: settings.barcodeScanner ?? current.barcodeScanner ?? defaultSettings.barcodeScanner,
    };
    localStorage.setItem(`${DB_PREFIX}settings`, JSON.stringify(updated));
    if (emitEvent) {
      notifyChange('settings');
    }
  } catch (error) {
    console.error('[LocalDB] Erro ao salvar settings:', error);
  }
}

// ========== FILA DE SINCRONIZAÇÃO OFFLINE ==========

const SYNC_QUEUE_KEY = `${DB_PREFIX}sync_queue`;

export function getSyncQueue(): SyncItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

export function enqueueSyncOperation(
  item: Omit<SyncItem, 'id' | 'timestamp'>
): void {
  try {
    const queue = getSyncQueue();
    const syncItem: SyncItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };
    queue.push(syncItem);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    notifyChange('sync_queue');
  } catch (error) {
    console.error('[LocalDB] Erro ao enfileirar sync:', error);
  }
}

export function dequeueSyncOperation(syncId: string): void {
  try {
    const queue = getSyncQueue();
    const filtered = queue.filter((item) => item.id !== syncId);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    notifyChange('sync_queue');
  } catch (error) {
    console.error('[LocalDB] Erro ao desenfileirar sync:', error);
  }
}

export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
  notifyChange('sync_queue');
}

/**
 * Garante que o banco local tenha um usuário admin padrão e configurações
 */
export function initializeDefaultLocalData(): void {
  // Inicializa configurações se não existirem
  if (!localStorage.getItem(`${DB_PREFIX}settings`)) {
    saveLocalSettings(defaultSettings, false);
  }

  // Inicializa usuário admin padrão no banco local se coleção users estiver vazia
  const users = getLocalCollection('users');
  if (users.length === 0) {
    const adminUser = {
      id: 'admin_master',
      name: 'Administrador',
      email: 'admin@biblioteca.com',
      password: 'admin123',
    };
    saveLocalCollection('users', [adminUser], false);
  }
}

// Inicializa automaticamente ao carregar o script
initializeDefaultLocalData();
