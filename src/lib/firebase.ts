import { initializeApp } from 'firebase/app';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBFkjB_HaACPN-_pJ0EKEum2gOHq0y7dzI",
    authDomain: "sistemadebibliotecamariarita.firebaseapp.com",
    projectId: "sistemadebibliotecamariarita",
    storageBucket: "sistemadebibliotecamariarita.firebasestorage.app",
    messagingSenderId: "818593704821",
    appId: "1:818593704821:web:1fa5c44bf2d12527aec13c",
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
