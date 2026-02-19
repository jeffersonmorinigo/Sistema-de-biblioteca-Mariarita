import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import {
  subscribeToCollection,
  addDocument,
  deleteDocument,
} from '@/lib/firestoreService';

interface AuthContextType {
  isAuthenticated: boolean;
  users: User[];
  usersLoaded: boolean;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  deleteUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Subscribe to users collection in Firestore
  useEffect(() => {
    let isInitialLoad = true;

    // Safety timeout: If Firestore doesn't respond in 15 seconds, proceed anyway
    // to prevent the user from being permanently stuck on the loading screen.
    const loadingTimeout = setTimeout(() => {
      if (!usersLoaded) {
        console.warn('Firestore initialization timed out. Proceeding...');
        setUsersLoaded(true);
      }
    }, 15000);

    const unsubscribe = subscribeToCollection<User>('users', async (firestoreUsers) => {
      console.log(`[Auth] Usuários recebidos do Firestore: ${firestoreUsers.length}`);
      setUsers(firestoreUsers);

      if (isInitialLoad) {
        isInitialLoad = false;
        clearTimeout(loadingTimeout); // Success, clear the safety timeout

        // If Firestore is completely empty, try to migrate or create default admin
        if (firestoreUsers.length === 0) {
          console.log('[Auth] Banco de dados vazio. Iniciando migração/seeding...');

          try {
            const { migrateLocalToFirestore } = await import('@/lib/migrationUtils');
            await migrateLocalToFirestore();

            // Re-verificar após migração
            const { getAll } = await import('@/lib/firestoreService');
            const currentUsers = await getAll<User>('users');
            if (currentUsers.length === 0) {
              console.log('[Auth] Nenhum usuário migrado. Criando administrador padrão.');
              await addDocument('users', {
                name: 'Administrador',
                email: 'admin@biblioteca.com',
                password: 'admin123',
              });
            } else {
              console.log(`[Auth] Migração concluída. ${currentUsers.length} usuários detectados.`);
            }
          } catch (err) {
            console.error('[Auth] Erro na inicialização:', err);
          }
        }
        setUsersLoaded(true);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, []);

  // Persist auth state in localStorage (just the boolean, not user data)
  useEffect(() => {
    localStorage.setItem('isAuthenticated', String(isAuthenticated));
  }, [isAuthenticated]);

  const login = (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    console.log(`[Auth] Tentativa de login: ${cleanEmail}`);

    // LOGIC 1: Hardcoded Emergency Bypass (Works even if Firestore is offline or empty)
    if (cleanEmail === 'admin@biblioteca.com' && cleanPass === 'admin123') {
      console.log('[Auth] Emergency Bypass ativado: Login concedido via credenciais padrão.');
      setIsAuthenticated(true);
      return true;
    }

    if (!usersLoaded) {
      console.warn('[Auth] Database não carregado. Fallback para Hardcoded falhou.');
      return false;
    }

    // LOGIC 2: Standard Firestore Login
    const user = users.find(u =>
      u.email.trim().toLowerCase() === cleanEmail &&
      u.password.trim() === cleanPass
    );

    if (user) {
      console.log(`[Auth] Login bem-sucedido via Firestore: ${cleanEmail}`);
      setIsAuthenticated(true);
      return true;
    }

    console.warn(`[Auth] Credenciais inválidas para: ${cleanEmail}. Usuários carregados: ${users.length}`);
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const addUser = async (userData: Omit<User, 'id'>) => {
    await addDocument('users', userData);
  };

  const deleteUser = async (userId: string) => {
    if (users.length <= 1) {
      console.error("Não é possível excluir o último usuário.");
      return;
    }
    await deleteDocument('users', userId);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, users, usersLoaded, login, logout, addUser, deleteUser }}>
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