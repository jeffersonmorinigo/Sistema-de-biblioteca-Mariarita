import { useState, useEffect, useCallback } from 'react';
import {
  getLocalCollection,
  upsertLocalItem,
  updateLocalItem,
  removeLocalItem,
  saveLocalCollection,
  enqueueSyncOperation,
} from '@/lib/localDb';
import { startCollectionSync, processSyncQueue } from '@/lib/syncService';

/**
 * Hook Híbrido / Local-First:
 * - Renderiza imediatamente a partir do banco local (latência zero, funciona 100% offline).
 * - Sincroniza em tempo real com o Firestore quando há conexão.
 * - Operações de add, update e remove aplicam no local instantaneamente e enfileiram sync para a nuvem.
 */
export function useFirestore<T extends { id: string }>(collectionName: string) {
  // Inicialização instantânea a partir do armazenamento local
  const [data, setData] = useState<T[]>(() => getLocalCollection<T>(collectionName));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Inicia sincronização bidirecional em segundo plano com o Firebase
    const unsubscribeFirestore = startCollectionSync<T>(collectionName, (updatedList) => {
      setData(updatedList);
      setLoading(false);
    });

    // 2. Escuta alterações locais feitas em outras partes do sistema
    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.collection === collectionName) {
        setData(getLocalCollection<T>(collectionName));
      }
    };

    window.addEventListener('local-db-change', handleLocalChange);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener('local-db-change', handleLocalChange);
    };
  }, [collectionName]);

  const add = useCallback(
    async (item: Omit<T, 'id'>): Promise<string> => {
      // Gera ID seguro local
      const newId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const newItem = { id: newId, ...item } as T;

      // 1. Salva no banco de dados local imediatamente
      upsertLocalItem(collectionName, newItem);

      // 2. Enfileira para sincronização com o Firebase
      enqueueSyncOperation({
        collection: collectionName,
        docId: newId,
        action: 'add',
        data: newItem,
      });

      // 3. Tenta enviar para a nuvem em segundo plano
      processSyncQueue().catch(() => {});

      return newId;
    },
    [collectionName]
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>) => {
      // 1. Atualiza no banco local imediatamente
      updateLocalItem(collectionName, id, updates);

      // 2. Enfileira para sincronização com o Firebase
      enqueueSyncOperation({
        collection: collectionName,
        docId: id,
        action: 'update',
        data: updates,
      });

      // 3. Tenta sincronizar
      processSyncQueue().catch(() => {});
    },
    [collectionName]
  );

  const remove = useCallback(
    async (id: string) => {
      const existing = getLocalCollection<T>(collectionName).find((i) => i.id === id);

      // 1. Remove do banco local imediatamente
      removeLocalItem(collectionName, id);

      // 2. Enfileira para exclusão no Firebase com dados completos para validação
      enqueueSyncOperation({
        collection: collectionName,
        docId: id,
        action: 'delete',
        data: existing,
      });

      // 3. Tenta sincronizar imediatamente
      processSyncQueue().catch(() => {});
    },
    [collectionName]
  );

  const setAll = useCallback(
    (items: T[]) => {
      saveLocalCollection(collectionName, items);
      // Para cada item não presente ou alterado, enfileira
      items.forEach((item) => {
        enqueueSyncOperation({
          collection: collectionName,
          docId: item.id,
          action: 'add',
          data: item,
        });
      });
      processSyncQueue().catch(() => {});
    },
    [collectionName]
  );

  return { data, loading, add, update, remove, setAll };
}
