import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import PrivateRoute from './auth/PrivateRoute';
import LoginPage from './pages/Login';
import MobileCollectorPage from './pages/MobileCollectorPage';
import BooksPage from './pages/app/Books';
import UsersPage from './pages/app/Users';
import StudentsPage from './pages/app/Students';
import LoansPage from './pages/app/Loans';
import SettingsPage from './pages/app/Settings';
import BackupPage from './pages/app/Backup';
import NotFound from './pages/NotFound';
import { Toaster } from '@/components/ui/sonner';
import InitialBackupNotification from '@/components/InitialBackupNotification'; // Importando o novo componente
import GlobalUpdateNotifier from '@/components/GlobalUpdateNotifier';
import { LicenseLockOverlay } from '@/components/LicenseLockOverlay';
import { useEffect } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

// A simple component to redirect based on auth status
const HomeRedirect = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/loans" replace /> : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  // O hook useInitialBackup foi substituído pelo componente InitialBackupNotification

  return (
    <Router>
      {/* Notificador de atualização automática OTA em tempo real */}
      <GlobalUpdateNotifier />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/books" element={<BooksPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/loans" element={<LoansPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/backup" element={<BackupPage />} />
        </Route>

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* Bloqueio de segurança e proteção anti-cópia/validade */}
      <LicenseLockOverlay />
      {/* Renderiza a notificação de backup após o login */}
      <InitialBackupNotification />
    </Router>
  );
};

const App = () => {
  useEffect(() => {
    // Disable right-click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Disable common developer shortcuts (F12, Ctrl+Shift+I, Ctrl+U)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
        <Toaster richColors />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;