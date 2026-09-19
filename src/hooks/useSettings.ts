import { useState, useEffect, useCallback } from 'react';
import { type AppSettings } from '@/lib/firestoreService';
import { getLocalSettings, saveLocalSettings, enqueueSyncOperation } from '@/lib/localDb';
import { startSettingsSync, processSyncQueue } from '@/lib/syncService';

/**
 * Hook para gerenciar configurações do sistema com suporte híbrido Local-First:
 * - Lê configurações do banco local instantaneamente.
 * - Sincroniza em tempo real com o Firestore.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => getLocalSettings());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Sincroniza com o Firestore
    const unsubscribeFirestore = startSettingsSync((newSettings) => {
      setSettings(newSettings);
      setLoading(false);
    });

    // 2. Escuta mudanças locais
    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.collection === 'settings') {
        setSettings(getLocalSettings());
      }
    };

    window.addEventListener('local-db-change', handleLocalChange);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener('local-db-change', handleLocalChange);
    };
  }, []);

  const update = useCallback(async (data: Partial<AppSettings>) => {
    // 1. Salva no banco local imediatamente
    saveLocalSettings(data);

    // 2. Enfileira para sincronização no Firebase
    enqueueSyncOperation({
      collection: 'settings',
      docId: 'app_settings',
      action: 'setSettings',
      data,
    });

    // 3. Tenta sincronizar
    processSyncQueue().catch(() => {});
  }, []);

  return { settings, loading, update };
}
