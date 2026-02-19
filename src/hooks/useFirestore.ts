import { useState, useEffect } from 'react';
import {
    subscribeToCollection,
    addDocument,
    updateDocument,
    deleteDocument,
} from '@/lib/firestoreService';

/**
 * Hook that mirrors useLocalStorage interface but uses Firestore.
 * Provides real-time data from a Firestore collection.
 */
export function useFirestore<T extends { id: string }>(collectionName: string) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToCollection<T>(collectionName, (items) => {
            setData(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName]);

    const add = async (item: Omit<T, 'id'>) => {
        await addDocument(collectionName, item as Record<string, any>);
    };

    const update = async (id: string, updates: Partial<T>) => {
        await updateDocument(collectionName, id, updates as Record<string, any>);
    };

    const remove = async (id: string) => {
        await deleteDocument(collectionName, id);
    };

    const setAll = (items: T[]) => {
        // This is used for batch operations like clearing loan history
        // We handle it by deleting items not in the new array
        setData(items);
    };

    return { data, loading, add, update, remove, setAll };
}
