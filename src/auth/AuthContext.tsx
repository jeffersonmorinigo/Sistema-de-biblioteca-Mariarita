import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/lib/types';
import {
  getLocalCollection,
  upsertLocalItem,
  removeLocalItem,
  enqueueSyncOperation,
} from '@/lib/localDb';
import { startCollectionSync, processSyncQueue } from '@/lib/syncService';
import {
  auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type FirebaseUser,
} from '@/lib/firebase-auth';

interface AuthContextType {
  isAuthenticated: boolean;
  users: User[];
  usersLoaded: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => void;
  deleteUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<User[]>(() => {
    const local = getLocalCollection<User>('users');
    return local.length > 0 ? local : [];
  });
  const [usersLoaded, setUsersLoaded] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setIsAuthenticated(!!firebaseUser);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = startCollectionSync<User>('users', (firestoreUsers) => {
      if (firestoreUsers.length > 0) {
        setUsers(firestoreUsers);
      } else {
        const currentLocal = getLocalCollection<User>('users');
        currentLocal.forEach((u) => {
          enqueueSyncOperation({
            collection: 'users',
            docId: u.id,
            action: 'add',
            data: u,
          });
        });
        processSyncQueue().catch(() => {});
      }
      setUsersLoaded(true);
    });

    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.collection === 'users') {
        setUsers(getLocalCollection<User>('users'));
      }
    };

    window.addEventListener('local-db-change', handleLocalChange);

    return () => {
      unsubscribe();
      window.removeEventListener('local-db-change', handleLocalChange);
    };
  }, []);

  const login = useCallback(async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setIsAuthenticated(true);
      return true;
    } catch (err: any) {
      console.warn('[Auth] Falha no login:', err?.message || 'Credenciais inválidas.');
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[Auth] Erro ao fazer logout:', err);
    }
    setIsAuthenticated(false);
  }, []);

  const addUser = async (userData: Omit<User, 'id'>) => {
    const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser: User = { id: newId, ...userData };

    upsertLocalItem('users', newUser);

    enqueueSyncOperation({
      collection: 'users',
      docId: newId,
      action: 'add',
      data: newUser,
    });

    processSyncQueue().catch(() => {});
  };

  const deleteUser = async (userId: string) => {
    if (users.length <= 1) {
      console.error('Não é possível excluir o último usuário.');
      return;
    }

    removeLocalItem('users', userId);

    enqueueSyncOperation({
      collection: 'users',
      docId: userId,
      action: 'delete',
    });

    processSyncQueue().catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        users,
        usersLoaded,
        login,
        logout,
        addUser,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
