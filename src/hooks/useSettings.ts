import { useState, useEffect, useCallback } from 'react';
import { type AppSettings } from '@/lib/firestoreService';
import { getLocalSettings, saveLocalSettings, enqueueSyncOperation } from '@/lib/localDb';
import { startSettingsSync, processSyncQueue } from '@/lib/syncService';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

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
    const updated = getLocalSettings();
    setSettings(updated);

    // 2. Salva diretamente no Firestore para persistência instantânea
    try {
      const docRef = doc(db, 'settings', 'app_settings');
      await setDoc(docRef, updated, { merge: true });
    } catch (err) {
      console.warn('[useSettings] Offline ou erro ao gravar no Firestore, enfileirando para sync posterior:', err);
      // Enfileira para sincronização no Firebase quando restabelecer conexão
      enqueueSyncOperation({
        collection: 'settings',
        docId: 'app_settings',
        action: 'setSettings',
        data: updated,
      });
      processSyncQueue().catch(() => {});
    }
  }, []);

  return { settings, loading, update };
}
