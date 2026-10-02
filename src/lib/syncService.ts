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
  SyncItem,
} from './localDb';
import { AppSettings } from './firestoreService';

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
          // Remove id do corpo do dado para não duplicar no Firestore
          const { id, ...saveData } = item.data || {};
          await setDoc(docRef, saveData, { merge: true });
          dequeueSyncOperation(item.id);
        } else if (item.action === 'delete') {
          const docRef = doc(db, item.collection, item.docId);
          try {
            await deleteDoc(docRef);
          } catch (delErr: any) {
            // Se o Firestore bloquear exclusão física (regras de segurança), aplica soft-delete
            if (delErr?.code === 'permission-denied' || delErr?.message?.includes('permission')) {
              console.warn(`[SyncService] Delete físico bloqueado por permissão em ${item.collection}/${item.docId}, marcando como deletado na nuvem...`);
              await setDoc(docRef, { isDeleted: true, status: 'deleted', title: '[EXCLUIDO]' }, { merge: true }).catch(() => {});
            } else {
              throw delErr;
            }
          }
          dequeueSyncOperation(item.id);
        } else if (item.action === 'setSettings') {
          const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
          await setDoc(docRef, item.data || {}, { merge: true });
          dequeueSyncOperation(item.id);
        }
      } catch (itemErr: any) {
        console.warn(`[SyncService] Erro ao sincronizar item individual (${item.action} em ${item.collection}):`, itemErr);
        // Se for erro definitivo de permissão, remove para não travar a fila infinitamente
        if (itemErr?.code === 'permission-denied' || itemErr?.message?.includes('permission')) {
          console.error('[SyncService] Permissão negada, descartando item para não travar a fila:', item);
          dequeueSyncOperation(item.id);
        } else {
          // Erro de conexão ou temporário: interrompe para tentar novamente quando houver rede
          throw itemErr;
        }
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
 * Sincroniza uma coleção específica da nuvem para o banco local
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
      // Itens que vêm do Firebase (ignora documentos com flag isDeleted ou status deleted)
      const cloudItems = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        .filter((item: any) => !item.isDeleted && item.status !== 'deleted') as T[];

      // Identifica itens locais que estão na fila de sync pendente de envio ou na lista de deletados
      const deletedLocalIds = getLocalDeletedIds(collectionName);
      const pendingSyncOps = getSyncQueue().filter((q) => q.collection === collectionName);
      const pendingDocIds = new Set(pendingSyncOps.map((q) => q.docId));
      const deletedDocIds = new Set([
        ...pendingSyncOps.filter((q) => q.action === 'delete').map((q) => q.docId),
        ...deletedLocalIds,
      ]);

      const localItems = getLocalCollection<T>(collectionName);

      // Itens finais mesclados:
      // Mantém itens locais que foram criados/alterados e ainda não foram enviados
      const mergedMap = new Map<string, T>();

      // 1. Adiciona itens da nuvem (exceto os que foram deletados localmente)
      cloudItems.forEach((item) => {
        if (!deletedDocIds.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      });

      // 2. Sobrepõe itens locais que têm alterações pendentes não enviadas
      localItems.forEach((localItem) => {
        if (pendingDocIds.has(localItem.id) && !deletedDocIds.has(localItem.id)) {
          mergedMap.set(localItem.id, localItem);
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
    },
    (error) => {
      console.warn(`[SyncService] Snapshot error em ${collectionName} (usando dados locais):`, error);
      updateState({ status: 'offline' });
      // Se falhar na nuvem, continua usando os dados locais
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
  // Dispara configurações locais primeiro
  const localSettings = getLocalSettings();
  if (onSettingsUpdate) {
    onSettingsUpdate(localSettings);
  }

  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);

  return onSnapshot(
    docRef,
    (docSnap) => {
      // Se há alterações de settings pendentes de envio na fila, NÃO sobrescreve o local com dados desatualizados
      const pendingSettingsOps = getSyncQueue().filter((q) => q.collection === 'settings');
      if (pendingSettingsOps.length > 0) {
        console.log('[SyncService] Settings pendentes na fila de sync; mantendo dados locais atuais.');
        return;
      }

      if (docSnap.exists()) {
        const cloudSettings = docSnap.data() as AppSettings;
        const currentLocal = getLocalSettings();

        // Mescla com segurança: a nuvem tem autoridade, mas preserva campos e listas válidas
        const merged: AppSettings = {
          schoolName: typeof cloudSettings.schoolName === 'string' && cloudSettings.schoolName.trim()
            ? cloudSettings.schoolName
            : (currentLocal.schoolName || defaultSettings.schoolName),
          book_categories: Array.isArray(cloudSettings.book_categories)
            ? cloudSettings.book_categories
            : (Array.isArray(currentLocal.book_categories) ? currentLocal.book_categories : defaultSettings.book_categories),
          student_classes: Array.isArray(cloudSettings.student_classes)
            ? cloudSettings.student_classes
            : (Array.isArray(currentLocal.student_classes) ? currentLocal.student_classes : defaultSettings.student_classes),
          book_shelves: Array.isArray(cloudSettings.book_shelves)
            ? cloudSettings.book_shelves
            : (Array.isArray(currentLocal.book_shelves) ? currentLocal.book_shelves : defaultSettings.book_shelves),
          book_types: Array.isArray(cloudSettings.book_types)
            ? cloudSettings.book_types
            : (Array.isArray(currentLocal.book_types) ? currentLocal.book_types : defaultSettings.book_types),
          barcodeScanner: cloudSettings.barcodeScanner || currentLocal.barcodeScanner || defaultSettings.barcodeScanner,
        };

        saveLocalSettings(merged, false);
        if (onSettingsUpdate) {
          onSettingsUpdate(merged);
        }
      } else {
        // Se a nuvem não tiver configurações ainda, salva as locais na nuvem
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
 * Força uma sincronização manual imediata de todas as coleções e filas pendentes
 */
export async function syncNow(): Promise<void> {
  updateState({ status: 'syncing' });
  await processSyncQueue();
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
