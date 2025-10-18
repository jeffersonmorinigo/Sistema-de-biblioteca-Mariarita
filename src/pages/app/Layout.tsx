import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

const AppLayout = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;