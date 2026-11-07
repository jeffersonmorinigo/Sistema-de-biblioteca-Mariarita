const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

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
const db = getFirestore(app);

async function main() {
  console.log('Atualizando settings/app_updates no Firestore...');
  const docRef = doc(db, 'settings', 'app_updates');
  await setDoc(docRef, {
    schoolName: 'Escola Maria Rita',
    latestVersion: '1.0.3',
    releaseNotes: 'Atualização automática em segundo plano (OTA) para múltiplos computadores sem necessidade de reinstalar o executável.',
    downloadUrl: 'https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases/download/v1.0.3/Sistema-de-Biblioteca-Maria-Rita-Setup-1.0.3.exe',
    distUrl: 'https://github.com/jeffersonmorinigo/Sistema-de-biblioteca-Mariarita/releases/download/v1.0.3/dist.zip',
    publishedAt: new Date().toISOString(),
  }, { merge: true });

  console.log('Documento settings/app_updates atualizado com sucesso no Firestore!');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao atualizar Firestore:', err);
  process.exit(1);
});
