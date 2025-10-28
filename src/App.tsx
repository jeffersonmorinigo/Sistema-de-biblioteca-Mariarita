import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import PrivateRoute from './auth/PrivateRoute';
import LoginPage from './pages/Login';
import BooksPage from './pages/app/Books';
import UsersPage from './pages/app/Users';
import StudentsPage from './pages/app/Students';
import LoansPage from './pages/app/Loans';
import SettingsPage from './pages/app/Settings';
import BackupPage from './pages/app/Backup';
import NotFound from './pages/NotFound';
import { Toaster } from '@/components/ui/sonner';
import { useInitialBackup } from '@/hooks/useInitialBackup'; // Importando o novo hook

// A simple component to redirect based on auth status
const HomeRedirect = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/loans" replace /> : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  // Chama o hook de backup inicial. Ele só será executado no ambiente Electron.
  useInitialBackup(); 
  
  return (
    <Router>
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
    </Router>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster richColors />
    </AuthProvider>
  );
};

export default App;