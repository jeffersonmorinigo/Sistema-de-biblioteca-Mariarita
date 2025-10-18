import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AppLayout from '@/pages/app/Layout';

const PrivateRoute = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export default PrivateRoute;