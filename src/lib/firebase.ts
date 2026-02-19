import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBkpRTlwdG1MTJZ9FsSSdtusElKN6S_vDQ",
    authDomain: "sgebiblioteca.firebaseapp.com",
    projectId: "sgebiblioteca",
    storageBucket: "sgebiblioteca.firebasestorage.app",
    messagingSenderId: "662718943634",
    appId: "1:662718943634:web:87eb530304d4e3d480f14b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
