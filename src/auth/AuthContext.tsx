import React, { createContext, useContext, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { User } from '@/lib/types';

// Simple ID generator
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

interface AuthContextType {
  isAuthenticated: boolean;
  users: User[];
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  deleteUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useLocalStorage('isAuthenticated', false);
  const [users, setUsers] = useLocalStorage<User[]>('users', []);

  useEffect(() => {
    // Create a default admin user if no users exist
    if (users.length === 0) {
      const adminUser: User = {
        id: generateId(),
        name: 'Administrador',
        email: 'admin@biblioteca.com',
        password: 'admin123',
      };
      setUsers([adminUser]);
    }
  }, []);

  const login = (email: string, pass: string) => {
    const user = users.find(u => u.email === email && u.password === pass);
    if (user) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const addUser = (userData: Omit<User, 'id'>) => {
    const newUser: User = { ...userData, id: generateId() };
    setUsers(prevUsers => [...prevUsers, newUser]);
  };

  const deleteUser = (userId: string) => {
    // Prevent deleting the last user
    if (users.length <= 1) {
      console.error("Cannot delete the last user.");
      return;
    }
    setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, users, login, logout, addUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};