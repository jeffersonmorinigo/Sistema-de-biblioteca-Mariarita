import { useState, useEffect } from 'react';
import { subscribeToSettings, updateSettings, type AppSettings } from '@/lib/firestoreService';

const defaultSettings: AppSettings = {
    schoolName: '',
    book_categories: ['GERAL'],
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
    book_shelves: ['N/A'],
    book_types: ['PESQUISA', 'DIDÁTICO', 'LITERATURA'],
};

/**
 * Hook to manage app settings from Firestore with real-time updates
 */
export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToSettings((newSettings) => {
            setSettings(newSettings);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const update = async (data: Partial<AppSettings>) => {
        await updateSettings(data);
    };

    return { settings, loading, update };
}
