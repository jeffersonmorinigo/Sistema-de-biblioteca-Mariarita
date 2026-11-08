import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { app } from './firebase';

export const auth = getAuth(app);
export { signInWithEmailAndPassword, signOut, onAuthStateChanged };
export type { FirebaseUser };
