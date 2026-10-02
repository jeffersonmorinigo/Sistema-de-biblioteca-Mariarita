import { initializeApp } from 'firebase/app';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBkpRTlwdG1MTJZ9FsSSdtusElKN6S_vDQ",
    authDomain: "sgebiblioteca.firebaseapp.com",
    projectId: "sgebiblioteca",
    storageBucket: "sgebiblioteca.firebasestorage.app",
    messagingSenderId: "662718943634",
    appId: "1:662718943634:web:87eb530304d4e3d480f14b",
    measurementId: "G-X4N9YEWQJQ"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence enabled
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
export default app;
