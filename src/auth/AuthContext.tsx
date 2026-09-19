import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import {
  getLocalCollection,
  upsertLocalItem,
  removeLocalItem,
  enqueueSyncOperation,
} from '@/lib/localDb';
import { startCollectionSync, processSyncQueue } from '@/lib/syncService';

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

  // Inicializa imediatamente com os usuários locais (inclusive admin padrão)
  const [users, setUsers] = useState<User[]>(() => {
    const local = getLocalCollection<User>('users');
    return local.length > 0
      ? local
      : [
          {
            id: 'admin_master',
            name: 'Administrador',
            email: 'admin@biblioteca.com',
            password: 'admin123',
          },
        ];
  });
  const [usersLoaded, setUsersLoaded] = useState(true);

  // Sincroniza usuários em tempo real com o Firestore
  useEffect(() => {
    const unsubscribe = startCollectionSync<User>('users', (firestoreUsers) => {
      if (firestoreUsers.length > 0) {
        setUsers(firestoreUsers);
      } else {
        // Se a nuvem estiver vazia, envia os usuários locais (ex: admin padrão) para a nuvem
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

  // Persiste estado de autenticação no localStorage
  useEffect(() => {
    localStorage.setItem('isAuthenticated', String(isAuthenticated));
  }, [isAuthenticated]);

  const login = (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    console.log(`[Auth] Tentativa de login: ${cleanEmail}`);

    // LOGIC 1: Hardcoded Emergency Bypass (Funciona mesmo se banco estiver vazio ou offline)
    if (cleanEmail === 'admin@biblioteca.com' && cleanPass === 'admin123') {
      console.log('[Auth] Emergency Bypass ativado: Login concedido.');
      setIsAuthenticated(true);
      return true;
    }

    // LOGIC 2: Usuários cadastrados (local + nuvem)
    const user = users.find(
      (u) =>
        u.email.trim().toLowerCase() === cleanEmail &&
        u.password.trim() === cleanPass
    );

    if (user) {
      console.log('[Auth] Usuário autenticado com sucesso.');
      setIsAuthenticated(true);
      return true;
    }

    console.warn('[Auth] Falha no login: Credenciais inválidas.');
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const addUser = async (userData: Omit<User, 'id'>) => {
    const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser: User = { id: newId, ...userData };

    // Salva localmente imediatamente
    upsertLocalItem('users', newUser);

    // Enfileira para sync na nuvem
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

    // Remove localmente imediatamente
    removeLocalItem('users', userId);

    // Enfileira para exclusão na nuvem
    enqueueSyncOperation({
      collection: 'users',
      docId: userId,
      action: 'delete',
    });

    processSyncQueue().catch(() => {});
  };

  // --- AUTO LOGOFF (40 MINUTOS DE INATIVIDADE) ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const INACTIVITY_LIMIT = 40 * 60 * 1000;
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn('[Auth] Logoff por inatividade (40 min).');
        logout();
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    resetTimer();
    events.forEach((event) => document.addEventListener(event, resetTimer));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => document.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

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