import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    onSnapshot,
    query,
    orderBy,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// ========== GENERIC CRUD OPERATIONS ==========

/**
 * Get all documents from a collection
 */
export async function getAll<T>(collectionName: string): Promise<T[]> {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })) as T[];
}

/**
 * Add a new document to a collection
 */
export async function addDocument<T extends Record<string, any>>(
    collectionName: string,
    data: Omit<T, 'id'>
): Promise<string> {
    const docRef = await addDoc(collection(db, collectionName), data);
    return docRef.id;
}

/**
 * Update an existing document 
 */
export async function updateDocument<T extends Record<string, any>>(
    collectionName: string,
    docId: string,
    data: Partial<T>
): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    // Remove 'id' from data to avoid storing it as a field
    const { id, ...updateData } = data as any;
    await updateDoc(docRef, updateData);
}

/**
 * Delete a document from a collection
 */
export async function deleteDocument(
    collectionName: string,
    docId: string
): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
}

// ========== REAL-TIME LISTENERS ==========

/**
 * Subscribe to real-time updates from a collection
 */
export function subscribeToCollection<T>(
    collectionName: string,
    callback: (data: T[]) => void
): Unsubscribe {
    const colRef = collection(db, collectionName);
    return onSnapshot(colRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as T[];
        callback(data);
    });
}

// ========== SETTINGS (single document) ==========

const SETTINGS_DOC_ID = 'app_settings';

export interface AppSettings {
    schoolName: string;
    book_categories: string[];
    student_classes: string[];
    book_shelves: string[];
    book_types: string[];
}

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
 * Get app settings
 */
export async function getSettings(): Promise<AppSettings> {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as AppSettings;
    }
    // Create default settings if none exist
    await setDoc(docRef, defaultSettings);
    return defaultSettings;
}

/**
 * Update app settings (partial)
 */
export async function updateSettings(
    data: Partial<AppSettings>
): Promise<void> {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(docRef, data, { merge: true });
}

/**
 * Subscribe to settings changes
 */
export function subscribeToSettings(
    callback: (settings: AppSettings) => void
): Unsubscribe {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as AppSettings);
        } else {
            // If no settings exist, create defaults
            setDoc(docRef, defaultSettings).then(() => {
                callback(defaultSettings);
            });
        }
    });
}
