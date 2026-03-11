import { getAll, addDocument, getSettings, updateSettings, setDocument } from './firestoreService';

const LOCAL_STORAGE_KEYS = {
    books: 'books',
    students: 'students',
    loans: 'loans',
    users: 'users',
    schoolName: 'schoolName',
    categories: 'book_categories',
    classes: 'student_classes',
    shelves: 'book_shelves',
    bookTypes: 'book_types'
};

const safeParse = (data: string | null, defaultValue: any = null) => {
    if (!data) return defaultValue;
    try {
        return JSON.parse(data);
    } catch (e) {
        console.warn('Erro ao parsear dado local, usando valor bruto ou padrão:', data);
        return data; // Retorna o dado bruto se não for JSON válido
    }
};

/**
 * Verifica se o Firestore está vazio e, se estiver, migra os dados do localStorage.
 */
export const migrateLocalToFirestore = async () => {
    try {
        // 1. Verificar se já existem dados no Firestore (usamos 'users' como indicador)
        const firestoreUsers = await getAll('users');
        if (firestoreUsers.length > 0) {
            console.log('Migração: Firestore já contém dados. Pulando...');
            return;
        }

        console.log('Migração: Iniciando transferência de dados locais para o Firestore...');

        // 2. Migrar Configurações
        const localSchoolName = localStorage.getItem(LOCAL_STORAGE_KEYS.schoolName);
        const localCategories = localStorage.getItem(LOCAL_STORAGE_KEYS.categories);
        const localClasses = localStorage.getItem(LOCAL_STORAGE_KEYS.classes);
        const localShelves = localStorage.getItem(LOCAL_STORAGE_KEYS.shelves);
        const localBookTypes = localStorage.getItem(LOCAL_STORAGE_KEYS.bookTypes);

        const newSettings: any = {};
        if (localSchoolName) newSettings.schoolName = safeParse(localSchoolName);
        if (localCategories) newSettings.book_categories = safeParse(localCategories);
        if (localClasses) newSettings.student_classes = safeParse(localClasses);
        if (localShelves) newSettings.book_shelves = safeParse(localShelves);
        if (localBookTypes) newSettings.book_types = safeParse(localBookTypes);

        if (Object.keys(newSettings).length > 0) {
            await updateSettings(newSettings);
            console.log('Migração: Configurações transferidas.');
        }

        // 3. Migrar Coleções
        const collections = ['books', 'students', 'loans', 'users'];

        for (const key of collections) {
            const localData = localStorage.getItem(key);
            if (localData) {
                const items = safeParse(localData);
                if (Array.isArray(items) && items.length > 0) {
                    console.log(`Migração: Transferindo ${items.length} itens de "${key}"...`);
                    for (const item of items) {
                        const originalId = item.id;
                        const { id, ...data } = item;
                        try {
                            if (originalId) {
                                await setDocument(key, originalId, data);
                            } else {
                                await addDocument(key, data);
                            }
                        } catch (docErr) {
                            console.error(`Erro ao migrar item da coleção ${key}:`, docErr);
                        }
                    }
                } else {
                    console.log(`Migração: Coleção "${key}" está vazia no localStorage.`);
                }
            } else {
                console.log(`Migração: Coleção "${key}" não encontrada no localStorage.`);
            }
        }

        console.log('Migração concluída com sucesso!');
    } catch (error) {
        console.error('Erro durante a migração para o Firestore:', error);
    }
};
